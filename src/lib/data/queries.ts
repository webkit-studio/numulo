import { and, count, desc, eq, gt, like, sql, sum } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import {
  accounts,
  categories,
  debts,
  settings,
  transactions,
  users,
} from "@/db/schema";
import { computeReserve } from "@/lib/calc/reserve";
import { daysInMonth, monthOf, type IsoMonth } from "@/lib/date";

export const ACCOUNT_ID = 1;

export interface AccountState {
  id: number;
  name: string;
  monthlyBudget: number;
  initialBalance: number;
  initialBalanceDate: string | null;
}

export async function getAccount(): Promise<AccountState> {
  const db = getDb();
  const [row] = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      monthlyBudget: accounts.monthlyBudget,
      initialBalance: accounts.initialBalance,
      initialBalanceDate: accounts.initialBalanceDate,
    })
    .from(accounts)
    .where(eq(accounts.id, ACCOUNT_ID));
  return row;
}

/**
 * The month numo should open on.
 *
 * Not simply "today": the seeded history ends before the current month, so
 * defaulting to now would greet you with an empty screen. Falls back to the
 * latest month that actually has transactions.
 */
export async function getDefaultMonth(today: string): Promise<IsoMonth> {
  const db = getDb();
  const [row] = await db
    .select({ latest: sql<string | null>`max(${transactions.date})` })
    .from(transactions)
    .where(eq(transactions.accountId, ACCOUNT_ID));

  const currentMonth = monthOf(today);
  const [inCurrent] = await db
    .select({ value: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, ACCOUNT_ID),
        like(transactions.date, `${currentMonth}%`),
      ),
    );

  if ((inCurrent?.value ?? 0) > 0) return currentMonth;
  return row?.latest ? monthOf(row.latest) : currentMonth;
}

export async function getMonthsWithData(): Promise<IsoMonth[]> {
  const db = getDb();
  const rows = await db
    .select({ month: sql<string>`substr(${transactions.date}, 1, 7)` })
    .from(transactions)
    .where(eq(transactions.accountId, ACCOUNT_ID))
    .groupBy(sql`substr(${transactions.date}, 1, 7)`)
    .orderBy(sql`substr(${transactions.date}, 1, 7)`);
  return rows.map((row) => row.month);
}

/** Household spending: not business, not a transfer, money going out. */
const householdSpending = sql`${transactions.isBusiness} = 0 and ${transactions.isTransfer} = 0 and ${transactions.amount} < 0`;

export interface MonthBalance {
  month: IsoMonth;
  budget: number;
  spent: number;
  /** budget − spent. Negative means the ceiling is already broken. */
  remaining: number;
  /** Money that arrived, transfers excluded, business included. */
  received: number;
  transactionCount: number;
}

export async function getMonthBalance(month: IsoMonth): Promise<MonthBalance> {
  const db = getDb();
  const account = await getAccount();

  const [spentRow] = await db
    .select({ total: sum(transactions.amount).mapWith(Number) })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, ACCOUNT_ID),
        like(transactions.date, `${month}%`),
        householdSpending,
      ),
    );

  const [receivedRow] = await db
    .select({ total: sum(transactions.amount).mapWith(Number) })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, ACCOUNT_ID),
        like(transactions.date, `${month}%`),
        eq(transactions.isTransfer, false),
        gt(transactions.amount, 0),
      ),
    );

  const [countRow] = await db
    .select({ value: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, ACCOUNT_ID),
        like(transactions.date, `${month}%`),
      ),
    );

  const spent = -(spentRow?.total ?? 0);
  return {
    month,
    budget: account.monthlyBudget,
    spent,
    remaining: account.monthlyBudget - spent,
    received: receivedRow?.total ?? 0,
    transactionCount: countRow?.value ?? 0,
  };
}

export async function getReserve() {
  const db = getDb();
  const account = await getAccount();

  const cutoff = account.initialBalanceDate;
  const [cashRow] = await db
    .select({ total: sum(transactions.amount).mapWith(Number) })
    .from(transactions)
    .where(
      cutoff
        ? and(
            eq(transactions.accountId, ACCOUNT_ID),
            gt(transactions.date, cutoff),
          )
        : eq(transactions.accountId, ACCOUNT_ID),
    );

  const debtRows = await db
    .select({
      remainingAmount: debts.remainingAmount,
      installmentAmount: debts.installmentAmount,
      active: debts.active,
    })
    .from(debts)
    .where(eq(debts.accountId, ACCOUNT_ID));

  // The sum above already applied the cut-off, so pass a single pre-summed
  // "transaction" rather than re-filtering thousands of rows in JS.
  return computeReserve({
    initialBalance: account.initialBalance,
    initialBalanceDate: null,
    transactions: [
      {
        date: "9999-12-31",
        amount: cashRow?.total ?? 0,
        isBusiness: false,
        isTransfer: false,
      },
    ],
    debts: debtRows,
  });
}

export interface Envelope {
  id: number;
  name: string;
  color: string;
  spent: number;
  limit: number | null;
  /** limit − spent, when a limit is set. */
  remaining: number | null;
  transactionCount: number;
}

export async function getEnvelopes(month: IsoMonth): Promise<Envelope[]> {
  const db = getDb();
  const rows = await db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      limit: categories.monthlyLimit,
      sort: categories.sort,
      spent: sql<number>`coalesce(-sum(case when ${householdSpending} and ${transactions.date} like ${`${month}%`} then ${transactions.amount} else 0 end), 0)`,
      transactionCount: sql<number>`count(case when ${householdSpending} and ${transactions.date} like ${`${month}%`} then 1 end)`,
    })
    .from(categories)
    .leftJoin(transactions, eq(transactions.categoryId, categories.id))
    .where(
      and(eq(categories.accountId, ACCOUNT_ID), eq(categories.inEnvelopes, true)),
    )
    .groupBy(categories.id)
    .orderBy(categories.sort);

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    color: row.color,
    spent: Number(row.spent),
    limit: row.limit,
    remaining: row.limit === null ? null : row.limit - Number(row.spent),
    transactionCount: Number(row.transactionCount),
  }));
}

export interface DaySpend {
  date: string;
  day: number;
  spent: number;
}

/** Daily household spending for the calendar heatmap. Days with none are 0. */
export async function getDailySpending(month: IsoMonth): Promise<DaySpend[]> {
  const db = getDb();
  const rows = await db
    .select({
      date: transactions.date,
      total: sum(transactions.amount).mapWith(Number),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, ACCOUNT_ID),
        like(transactions.date, `${month}%`),
        householdSpending,
      ),
    )
    .groupBy(transactions.date);

  const byDate = new Map(rows.map((row) => [row.date, -(row.total ?? 0)]));

  return Array.from({ length: daysInMonth(month) }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    return { date, day, spent: byDate.get(date) ?? 0 };
  });
}

export interface TransactionRow {
  id: number;
  date: string;
  amount: number;
  merchant: string | null;
  description: string | null;
  categoryId: number | null;
  categoryName: string | null;
  categoryColor: string | null;
  ownerName: string | null;
  isBusiness: boolean;
  isTransfer: boolean;
}

export interface TransactionFilters {
  month?: IsoMonth;
  search?: string;
  ownerId?: number;
  categoryId?: number;
  business?: boolean;
  transfer?: boolean;
  limit?: number;
}

export async function getTransactions(
  filters: TransactionFilters = {},
): Promise<TransactionRow[]> {
  const db = getDb();
  const conditions = [eq(transactions.accountId, ACCOUNT_ID)];

  if (filters.month) {
    conditions.push(like(transactions.date, `${filters.month}%`));
  }
  if (filters.search) {
    const term = `%${filters.search.toLowerCase()}%`;
    conditions.push(
      sql`(lower(coalesce(${transactions.merchant}, '')) like ${term} or lower(coalesce(${transactions.description}, '')) like ${term})`,
    );
  }
  if (filters.ownerId) conditions.push(eq(transactions.ownerId, filters.ownerId));
  if (filters.categoryId) {
    conditions.push(eq(transactions.categoryId, filters.categoryId));
  }
  // Business and transfers are hidden by default — they are excluded from the
  // household's numbers, so showing them unasked makes the list disagree with
  // every total on screen.
  if (!filters.business) conditions.push(eq(transactions.isBusiness, false));
  if (!filters.transfer) conditions.push(eq(transactions.isTransfer, false));

  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      merchant: transactions.merchant,
      description: transactions.description,
      categoryId: transactions.categoryId,
      categoryName: categories.name,
      categoryColor: categories.color,
      ownerName: users.name,
      isBusiness: transactions.isBusiness,
      isTransfer: transactions.isTransfer,
    })
    .from(transactions)
    .leftJoin(categories, eq(transactions.categoryId, categories.id))
    .leftJoin(users, eq(transactions.ownerId, users.id))
    .where(and(...conditions))
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(filters.limit ?? 200);
}

export async function getCategories() {
  const db = getDb();
  return db
    .select({
      id: categories.id,
      name: categories.name,
      color: categories.color,
      monthlyLimit: categories.monthlyLimit,
    })
    .from(categories)
    .where(eq(categories.accountId, ACCOUNT_ID))
    .orderBy(categories.sort);
}

export async function getUsers() {
  return getDb().select({ id: users.id, name: users.name }).from(users);
}

export async function getSettings() {
  const db = getDb();
  const [row] = await db
    .select()
    .from(settings)
    .where(eq(settings.accountId, ACCOUNT_ID));
  return row ?? null;
}

/** How many transactions still have no category — the honest "unsorted" count. */
export async function getUncategorisedCount(month: IsoMonth): Promise<number> {
  const db = getDb();
  const [row] = await db
    .select({ value: count() })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, ACCOUNT_ID),
        like(transactions.date, `${month}%`),
        sql`${transactions.categoryId} is null`,
        householdSpending,
      ),
    );
  return row?.value ?? 0;
}

/** Latest import batch date — the "výpis k DD. MM." freshness indicator. */
export async function getLatestTransactionDate(): Promise<string | null> {
  const db = getDb();
  const [row] = await db
    .select({ latest: sql<string | null>`max(${transactions.date})` })
    .from(transactions)
    .where(eq(transactions.accountId, ACCOUNT_ID));
  return row?.latest ?? null;
}

export interface MerchantGroup {
  merchant: string;
  count: number;
  /** Positive total spent with this merchant across the whole history. */
  total: number;
  firstDate: string;
  lastDate: string;
  sampleId: number;
}

/**
 * Uncategorised spending grouped by merchant, biggest first.
 *
 * Sorting one merchant sorts every transaction from it, so this turns a
 * hundred-row chore into a handful of decisions — and the biggest money gets
 * decided first.
 */
export async function getUncategorisedMerchants(
  limit = 60,
): Promise<MerchantGroup[]> {
  const db = getDb();
  const rows = await db
    .select({
      merchant: sql<string>`coalesce(${transactions.merchant}, ${transactions.description})`,
      count: sql<number>`count(*)`,
      total: sql<number>`-sum(${transactions.amount})`,
      firstDate: sql<string>`min(${transactions.date})`,
      lastDate: sql<string>`max(${transactions.date})`,
      sampleId: sql<number>`min(${transactions.id})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, ACCOUNT_ID),
        sql`${transactions.categoryId} is null`,
        householdSpending,
      ),
    )
    .groupBy(sql`coalesce(${transactions.merchant}, ${transactions.description})`)
    .orderBy(sql`-sum(${transactions.amount}) desc`)
    .limit(limit);

  return rows.map((row) => ({
    merchant: row.merchant ?? "—",
    count: Number(row.count),
    total: Number(row.total),
    firstDate: row.firstDate,
    lastDate: row.lastDate,
    sampleId: Number(row.sampleId),
  }));
}
