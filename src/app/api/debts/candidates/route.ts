import { and, desc, eq, isNotNull, lt, or, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { debtPayments, transactions } from "@/db/schema";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Words that show up on a repayment when the bank prints no VS. */
const HINTS = ["splátka", "splatka", "splátku", "půjčk", "pujck", "dluh"];

/**
 * Payments that read like debt repayments but carry no VS or account number.
 *
 * Their statement rows say only "SPLÁTKA DLUHU 05/2026", which names no
 * creditor — so code offers them and a person picks the debt. Guessing here
 * would silently credit the wrong person.
 */
export const GET = withJsonErrors(async () => {
  const db = getDb();

  const linked = await db
    .select({ transactionId: debtPayments.transactionId })
    .from(debtPayments)
    .where(
      and(
        eq(debtPayments.accountId, ACCOUNT_ID),
        isNotNull(debtPayments.transactionId),
      ),
    );
  const used = new Set(linked.map((row) => row.transactionId));

  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      merchant: transactions.merchant,
      description: transactions.description,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, ACCOUNT_ID),
        lt(transactions.amount, 0),
        or(
          ...HINTS.map(
            (hint) =>
              sql`(lower(coalesce(${transactions.merchant}, '')) like ${`%${hint}%`}
                or lower(coalesce(${transactions.description}, '')) like ${`%${hint}%`})`,
          ),
        ),
      ),
    )
    .orderBy(desc(transactions.date))
    .limit(50);

  return NextResponse.json({
    candidates: rows
      .filter((row) => !used.has(row.id))
      .map((row) => ({
        id: row.id,
        date: row.date,
        amount: -row.amount,
        label: row.merchant || row.description || "—",
      })),
  });
});
