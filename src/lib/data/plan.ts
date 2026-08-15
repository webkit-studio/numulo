import { and, asc, eq, like, lt, sql, sum } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import {
  debtPayments,
  debts,
  plannedItems,
  recurringMonthly,
  recurringPayments,
  recurringYearly,
  subscriptions,
  transactions,
} from "@/db/schema";
import { computeMonthlyGoal, type MonthlyGoal } from "@/lib/calc/monthly-goal";
import { summariseDebts } from "@/lib/calc/debts";
import type { IsoMonth } from "@/lib/date";
import { ACCOUNT_ID, getAccount } from "./queries";

/** Everything the Plán, Pravidelné and Dluhy screens read. */

export async function getPlannedItems() {
  return getDb()
    .select()
    .from(plannedItems)
    .where(eq(plannedItems.accountId, ACCOUNT_ID))
    .orderBy(asc(plannedItems.interval), asc(plannedItems.month), asc(plannedItems.name));
}

export async function getSubscriptions() {
  return getDb()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.accountId, ACCOUNT_ID))
    .orderBy(asc(subscriptions.name));
}

export async function getRecurringMonthly() {
  return getDb()
    .select()
    .from(recurringMonthly)
    .where(eq(recurringMonthly.accountId, ACCOUNT_ID))
    .orderBy(asc(recurringMonthly.day), asc(recurringMonthly.name));
}

export async function getRecurringYearly() {
  return getDb()
    .select()
    .from(recurringYearly)
    .where(eq(recurringYearly.accountId, ACCOUNT_ID))
    .orderBy(asc(recurringYearly.dueMonth), asc(recurringYearly.name));
}

export async function getDebts() {
  return getDb()
    .select()
    .from(debts)
    .where(eq(debts.accountId, ACCOUNT_ID))
    .orderBy(asc(debts.creditor));
}

export async function getDebtPayments(debtId?: number) {
  const db = getDb();
  return db
    .select()
    .from(debtPayments)
    .where(
      debtId === undefined
        ? eq(debtPayments.accountId, ACCOUNT_ID)
        : and(eq(debtPayments.accountId, ACCOUNT_ID), eq(debtPayments.debtId, debtId)),
    )
    .orderBy(asc(debtPayments.date));
}

export async function getDebtsSummary(fromMonth: IsoMonth) {
  return summariseDebts(await getDebts(), fromMonth);
}

/** The `(type, id)` pairs already ticked off for a month. */
export async function getPaidThisMonth(month: IsoMonth): Promise<Set<string>> {
  const rows = await getDb()
    .select({
      itemType: recurringPayments.itemType,
      itemId: recurringPayments.itemId,
    })
    .from(recurringPayments)
    .where(
      and(
        eq(recurringPayments.accountId, ACCOUNT_ID),
        eq(recurringPayments.month, month),
      ),
    );

  return new Set(rows.map((row) => `${row.itemType}:${row.itemId}`));
}

export async function getMonthlyGoal(month: IsoMonth): Promise<MonthlyGoal> {
  const db = getDb();
  const account = await getAccount();

  // Only the incoming total is needed, so sum it in SQL rather than pulling
  // every row across just to add it up in JS.
  const [received] = await db
    .select({ total: sum(transactions.amount).mapWith(Number) })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, ACCOUNT_ID),
        like(transactions.date, `${month}%`),
        eq(transactions.isTransfer, false),
      ),
    );

  const [debtRows, planned] = await Promise.all([getDebts(), getPlannedItems()]);
  const incoming = Math.max(received?.total ?? 0, 0);

  return computeMonthlyGoal({
    month,
    monthlyBudget: account.monthlyBudget,
    debts: debtRows,
    transactions: [
      {
        date: `${month}-01`,
        amount: incoming,
        isBusiness: false,
        isTransfer: false,
      },
    ],
    plannedItems: planned,
  });
}

/* -------------------------------------------------------------- detection */

/**
 * Household spending shaped for the subscription detector.
 *
 * Only merchant, amount, month and day cross over — the detector is arithmetic
 * on those four fields and has no business seeing anything else.
 */
export async function getRecurringCandidates(): Promise<
  { merchant: string; amount: number; month: string; day: number }[]
> {
  const rows = await getDb()
    .select({
      merchant: sql<string>`coalesce(nullif(${transactions.merchant}, ''), ${transactions.description})`,
      amount: sql<number>`-${transactions.amount}`,
      month: sql<string>`substr(${transactions.date}, 1, 7)`,
      day: sql<number>`cast(substr(${transactions.date}, 9, 2) as integer)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, ACCOUNT_ID),
        eq(transactions.isTransfer, false),
        eq(transactions.isBusiness, false),
        lt(transactions.amount, 0),
      ),
    );

  return rows.filter((row) => row.merchant !== null && row.merchant !== "");
}
