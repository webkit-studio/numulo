"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { czkToHalere, formatCzk } from "@/lib/money";

/**
 * Recording a payment against a debt.
 *
 * The payment is kept as its own row *and* subtracted from the remainder. The
 * remainder alone would answer "how much is left" but not "when did we pay
 * what", and the payoff estimate is only believable if the history behind it
 * is there to check.
 */

export async function recordDebtPayment(
  debtId: string,
  creditor: string,
  amountCzk: string,
  date: string,
): Promise<{ error: string | null; notice?: string }> {
  const value = Number(amountCzk.replace(",", ".").replace(/[\s ]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return { error: "Částka musí být kladné číslo." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Datum musí být ve tvaru RRRR-MM-DD." };

  const amount = czkToHalere(value);
  const supabase = await createClient();

  const { data: debt, error: readError } = await supabase
    .from("debts")
    .select("household_id, remaining_amount")
    .eq("id", debtId)
    .maybeSingle();

  if (readError) return { error: readError.message };
  if (!debt) return { error: "Dluh se nenašel." };

  const { error: insertError } = await supabase.from("debt_payments").insert({
    household_id: debt.household_id,
    debt_id: debtId,
    amount,
    date,
  });
  if (insertError) return { error: insertError.message };

  // Never below zero: an overpayment closes the debt, it does not invert it.
  const remaining = Math.max(0, Number(debt.remaining_amount) - amount);
  const { error: updateError } = await supabase
    .from("debts")
    .update({ remaining_amount: remaining })
    .eq("id", debtId);
  if (updateError) return { error: updateError.message };

  revalidatePath("/", "layout");
  return {
    error: null,
    notice:
      remaining === 0
        ? `${creditor} — splaceno. 🌱`
        : `${creditor} — zaplaceno ${formatCzk(amount)}, zbývá ${formatCzk(remaining)}`,
  };
}

/**
 * Automatic matching: scan the statements for payments that belong to a debt.
 *
 * A payment claims a debt through its variable symbol or the target account —
 * never through the creditor's name, which repeats across debts. Every match
 * becomes a debt_payments row carrying the transaction id, and the unique
 * constraint on that column is what makes this button safe to press twice:
 * a payment already recorded simply refuses to record again.
 */
export async function matchDebtPayments(): Promise<{
  error: string | null;
  notice?: string;
  matched: number;
}> {
  const { matchDebtPayments: match } = await import("@/lib/debts/match");
  const supabase = await createClient();

  const [{ data: debtRows }, { data: txRows }, { data: recorded }] = await Promise.all([
    supabase.from("debts").select("id, household_id, creditor, target_account, vs, active, remaining_amount"),
    supabase
      .from("transactions")
      .select("id, date, amount, merchant, description, vs, counter_account")
      .lt("amount", 0)
      .eq("is_transfer", false),
    supabase.from("debt_payments").select("transaction_id"),
  ]);

  const already = new Set((recorded ?? []).map((row) => row.transaction_id as string));

  const matches = match(
    (txRows ?? [])
      .filter((row) => !already.has(row.id as string))
      .map((row) => ({
        id: row.id as string,
        date: String(row.date),
        amount: Number(row.amount),
        merchant: row.merchant as string | null,
        description: row.description as string | null,
        vs: row.vs as string | null,
        counterAccount: row.counter_account as string | null,
      })),
    (debtRows ?? []).map((row) => ({
      id: row.id as string,
      creditor: String(row.creditor),
      targetAccount: row.target_account as string | null,
      vs: row.vs as string | null,
      active: Boolean(row.active),
    })),
  );

  if (matches.length === 0) {
    return { error: null, notice: "Žádná nespárovaná platba nesedí na VS ani účet.", matched: 0 };
  }

  const debtsById = new Map((debtRows ?? []).map((row) => [row.id as string, row]));
  let recordedCount = 0;
  let totalAmount = 0;

  for (const found of matches) {
    const debt = debtsById.get(found.debtId);
    if (!debt) continue;

    const { error } = await supabase.from("debt_payments").insert({
      household_id: debt.household_id,
      debt_id: found.debtId,
      amount: found.amount,
      date: found.date,
      transaction_id: found.transactionId,
      note: found.reason === "vs" ? "spárováno podle VS" : "spárováno podle účtu",
    });
    if (error) continue; // unique transaction_id — already recorded elsewhere

    const remaining = Math.max(0, Number(debt.remaining_amount) - found.amount);
    await supabase.from("debts").update({ remaining_amount: remaining }).eq("id", found.debtId);
    debt.remaining_amount = remaining;

    recordedCount += 1;
    totalAmount += found.amount;
  }

  revalidatePath("/", "layout");
  return {
    error: null,
    notice:
      recordedCount === 0
        ? "Všechny sedící platby už byly zaznamenané."
        : `Spárováno ${recordedCount} plateb za ${formatCzk(totalAmount)}.`,
    matched: recordedCount,
  };
}
