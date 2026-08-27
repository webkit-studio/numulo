"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { czkToHalere } from "@/lib/money";
import type { ActionState } from "./state";

/**
 * Editing a transaction, and remembering the decision.
 *
 * Re-categorising one payment teaches Numulo the merchant, so every other
 * payment from them follows. That is the difference between sorting a
 * statement once and sorting it every month — and the toast reports how many
 * other rows moved, because otherwise the feature is invisible.
 */
export async function setCategory(
  transactionId: string,
  categoryId: string | null,
  options: { learn?: boolean } = {},
): Promise<{ moved: number; merchant: string | null }> {
  const supabase = await createClient();

  const { data: tx } = await supabase
    .from("transactions")
    .select("id, household_id, merchant, description")
    .eq("id", transactionId)
    .maybeSingle();

  if (!tx) return { moved: 0, merchant: null };

  await supabase.from("transactions").update({ category_id: categoryId }).eq("id", transactionId);

  const merchant = (tx.merchant as string | null) ?? (tx.description as string | null);
  let moved = 0;

  if (options.learn !== false && categoryId && merchant && merchant.trim().length >= 3) {
    await supabase.from("rules").upsert(
      {
        household_id: tx.household_id,
        kind: "merchant->category",
        pattern: merchant,
        target: categoryId,
        created_from: "transakce",
      },
      { onConflict: "household_id,kind,pattern" },
    );

    // Applied only where nothing is set yet: a rule must never overwrite a
    // decision someone made by hand.
    const { data: touched } = await supabase
      .from("transactions")
      .update({ category_id: categoryId })
      .eq("household_id", tx.household_id)
      .is("category_id", null)
      .ilike("merchant", `%${merchant}%`)
      .select("id");

    moved = touched?.length ?? 0;
  }

  revalidatePath("/", "layout");
  return { moved, merchant };
}

export async function setFlag(
  transactionId: string,
  flag: "is_business" | "is_transfer",
  value: boolean,
): Promise<void> {
  const supabase = await createClient();
  await supabase.from("transactions").update({ [flag]: value }).eq("id", transactionId);
  revalidatePath("/", "layout");
}

export async function addManualTransaction(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const householdId = String(form.get("householdId") ?? "");
  const merchant = String(form.get("merchant") ?? "").trim();
  const date = String(form.get("date") ?? "");
  const categoryId = String(form.get("categoryId") ?? "");
  const direction = String(form.get("direction") ?? "expense");
  const raw = Number(String(form.get("amount") ?? "").replace(",", "."));

  if (!merchant) return { error: "Napiš, za co to bylo." };
  if (!Number.isFinite(raw) || raw <= 0) return { error: "Částka musí být kladné číslo." };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Datum musí být RRRR-MM-DD." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("transactions").insert({
    household_id: householdId,
    // Unique per entry rather than derived from the contents: two coffees at
    // the same price on the same day are two payments, and a content hash
    // would swallow the second one.
    fingerprint: `manual:${crypto.randomUUID()}`,
    date,
    amount: czkToHalere(direction === "income" ? raw : -raw),
    currency: "CZK",
    merchant,
    description: merchant,
    category_id: categoryId === "" ? null : categoryId,
    owner_id: user?.id ?? null,
    source: "manual",
  });

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null, notice: `Zapsáno: ${merchant}` };
}
