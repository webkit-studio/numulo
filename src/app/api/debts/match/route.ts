import { and, eq, isNotNull, lt, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { debtPayments, debts, transactions } from "@/db/schema";
import { matchDebtPayments } from "@/lib/debts/match";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Finds imported payments that belong to a debt and books them.
 *
 * A payment already linked to a transaction is skipped — the unique index on
 * `transaction_id` is the backstop, but filtering first keeps one re-run from
 * looking like a wall of errors.
 */
export const POST = withJsonErrors(async () => {
  const db = getDb();

  const [debtRows, alreadyLinked] = await Promise.all([
    db.select().from(debts).where(eq(debts.accountId, ACCOUNT_ID)),
    db
      .select({ transactionId: debtPayments.transactionId })
      .from(debtPayments)
      .where(
        and(
          eq(debtPayments.accountId, ACCOUNT_ID),
          isNotNull(debtPayments.transactionId),
        ),
      ),
  ]);

  const linked = new Set(alreadyLinked.map((row) => row.transactionId));

  const candidates = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      amount: transactions.amount,
      merchant: transactions.merchant,
      description: transactions.description,
    })
    .from(transactions)
    .where(
      and(eq(transactions.accountId, ACCOUNT_ID), lt(transactions.amount, 0)),
    );

  const matches = matchDebtPayments(
    candidates.filter((row) => !linked.has(row.id)),
    debtRows,
  );

  if (matches.length === 0) {
    return NextResponse.json({ ok: true, booked: 0, debts: [] });
  }

  const perDebt = new Map<number, number>();
  for (const match of matches) {
    perDebt.set(match.debtId, (perDebt.get(match.debtId) ?? 0) + match.amount);
  }

  const statements = [
    ...matches.map((match) =>
      db
        .insert(debtPayments)
        .values({
          accountId: ACCOUNT_ID,
          debtId: match.debtId,
          amount: match.amount,
          date: match.date,
          transactionId: match.transactionId,
          note: `spárováno podle ${match.reason === "vs" ? "VS" : "čísla účtu"}`,
        })
        .onConflictDoNothing(),
    ),
    ...[...perDebt.entries()].map(([debtId, total]) =>
      db
        .update(debts)
        // max(…, 0) so an overpayment cannot drive the balance negative.
        .set({ remainingAmount: sql`max(${debts.remainingAmount} - ${total}, 0)` })
        .where(and(eq(debts.accountId, ACCOUNT_ID), eq(debts.id, debtId))),
    ),
  ];

  await db.batch(statements as never);

  return NextResponse.json({
    ok: true,
    booked: matches.length,
    debts: [...perDebt.entries()].map(([id, total]) => ({ id, total })),
  });
});
