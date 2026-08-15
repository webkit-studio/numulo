import { and, eq, sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { debtPayments, debts } from "@/db/schema";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { withJsonErrors } from "@/lib/http";
import { czkToHalere } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * Records a payment against a debt.
 *
 * The payment row and the new remaining balance are written together, because
 * a history that disagrees with the balance is worse than no history: it makes
 * the number on screen unarguable-with.
 */
export const POST = withJsonErrors(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as {
    debtId?: unknown;
    amount?: unknown;
    date?: unknown;
    note?: unknown;
    /** Set when the payment is being linked to an imported row. */
    transactionId?: unknown;
  } | null;

  const debtId = Number(body?.debtId);
  if (!Number.isInteger(debtId)) {
    return NextResponse.json({ error: "Chybí dluh." }, { status: 400 });
  }

  const amount = czkToHalere(
    typeof body?.amount === "number"
      ? body.amount
      : Number(String(body?.amount ?? "").replace(",", ".")),
  );
  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ error: "Částka musí být kladné číslo." }, { status: 400 });
  }

  const date = String(body?.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Datum musí být RRRR-MM-DD." }, { status: 400 });
  }

  const db = getDb();
  const [debt] = await db
    .select()
    .from(debts)
    .where(and(eq(debts.accountId, ACCOUNT_ID), eq(debts.id, debtId)));

  if (!debt) {
    return NextResponse.json({ error: "Dluh nenalezen." }, { status: 404 });
  }

  const remaining = Math.max(debt.remainingAmount - amount, 0);

  await db.batch([
    db.insert(debtPayments).values({
      accountId: ACCOUNT_ID,
      debtId,
      amount,
      date,
      // The unique index on transaction_id stops one statement row from being
      // booked against two debts.
      transactionId: Number.isInteger(Number(body?.transactionId))
        ? Number(body?.transactionId)
        : null,
      note: typeof body?.note === "string" && body.note.trim() !== "" ? body.note.trim() : null,
    }),
    db
      .update(debts)
      .set({ remainingAmount: remaining, active: remaining > 0 })
      .where(eq(debts.id, debtId)),
  ]);

  return NextResponse.json({ ok: true, remaining, cleared: remaining === 0 });
});

/** Removing a payment puts the money back on the debt. */
export const DELETE = withJsonErrors(async (request: NextRequest) => {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Chybí id." }, { status: 400 });
  }

  const db = getDb();
  const [payment] = await db
    .select()
    .from(debtPayments)
    .where(and(eq(debtPayments.accountId, ACCOUNT_ID), eq(debtPayments.id, id)));

  if (!payment) {
    return NextResponse.json({ error: "Platba nenalezena." }, { status: 404 });
  }

  await db.batch([
    db.delete(debtPayments).where(eq(debtPayments.id, id)),
    db
      .update(debts)
      .set({
        remainingAmount: sql`${debts.remainingAmount} + ${payment.amount}`,
        active: true,
      })
      .where(eq(debts.id, payment.debtId)),
  ]);

  return NextResponse.json({ ok: true });
});
