"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { IsoMonth } from "@/lib/date";

/**
 * Marking a recurring item paid, and the "what if we cancelled this" toggle.
 *
 * Paid is per month, so a row exists for August or it does not — there is no
 * flag to reset when the month turns over. The cancellation simulation writes
 * its own column and never touches `active`: the point of the exercise is to
 * see the saving without losing the subscription, so the row stays exactly
 * where it was.
 */

export type Kind = "subscription" | "monthly" | "yearly";

export async function setPaid(
  householdId: string,
  kind: Kind,
  itemId: string,
  month: IsoMonth,
  paid: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient();

  if (paid) {
    const { error } = await supabase
      .from("recurring_payments")
      .upsert(
        { household_id: householdId, item_type: kind, item_id: itemId, month },
        { onConflict: "item_type,item_id,month" },
      );
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("recurring_payments")
      .delete()
      .eq("household_id", householdId)
      .eq("item_type", kind)
      .eq("item_id", itemId)
      .eq("month", month);
    if (error) return { error: error.message };
  }

  revalidatePath("/", "layout");
  return { error: null };
}

export async function setSubscriptionSimulated(
  id: string,
  simulated: boolean,
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("subscriptions")
    .update({ simulated_cancel: simulated })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

/**
 * Accepting or dismissing a detected subscription.
 *
 * A dismissal is stored, not forgotten: without it the same three charges
 * would be re-detected on every page load and the household would be asked
 * about NVIDIA forever. It goes in `rules` next to the category rules, because
 * it is the same kind of thing — a decision about a merchant, made once.
 */
export async function acceptDetected(
  householdId: string,
  name: string,
  amount: number,
  day: number | null,
): Promise<{ error: string | null; notice?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("subscriptions").insert({
    household_id: householdId,
    name,
    amount,
    day,
    active: true,
    status: "confirmed",
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null, notice: `Předplatné přidáno: ${name}` };
}

export async function dismissDetected(
  householdId: string,
  merchant: string,
): Promise<{ error: string | null; notice?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.from("rules").insert({
    household_id: householdId,
    kind: "merchant->not_subscription",
    pattern: merchant.trim().toLowerCase(),
    target: "ignore",
    created_from: "auto-detekce",
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null, notice: `${merchant} — nebudeme se ptát znovu` };
}
