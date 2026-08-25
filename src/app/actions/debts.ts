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
