"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { czkToHalere } from "@/lib/money";
import type { ActionState } from "./state";

/**
 * Household settings and the shared CRUD used by every editable list.
 *
 * Nothing here checks who the caller is: row-level security already answers
 * that, and a second check in application code would be a second place for the
 * answer to be wrong. What these do enforce is shape — a budget that is a
 * number, a day that is 1–31 — because the database will take "0" for an
 * answer where a person meant to type something else.
 */

const number = (form: FormData, key: string): number | null => {
  const raw = String(form.get(key) ?? "").replace(",", ".").trim();
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
};

export async function saveHouseholdSettings(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get("householdId") ?? "");
  const name = String(form.get("name") ?? "").trim();
  const budget = number(form, "monthlyBudget");
  const balance = number(form, "initialBalance");
  const balanceDate = String(form.get("initialBalanceDate") ?? "").trim();

  if (!name) return { error: "Účet musí mít název." };
  if (budget === null || budget < 0) return { error: "Měsíční rozpočet musí být číslo." };
  // An overdrawn account is still a position, so a negative opening balance
  // is allowed — only nonsense is refused.
  if (balance === null) return { error: "Počáteční stav musí být číslo." };
  if (balanceDate !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(balanceDate)) {
    return { error: "Datum musí být ve tvaru RRRR-MM-DD." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({
      name,
      monthly_budget: czkToHalere(budget),
      initial_balance: czkToHalere(balance),
      initial_balance_date: balanceDate === "" ? null : balanceDate,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null, notice: "Uloženo." };
}

export async function saveSavings(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const id = String(form.get("householdId") ?? "");
  const mode = String(form.get("mode") ?? "amount");
  const value = number(form, "value");

  if (mode !== "amount" && mode !== "percent") return { error: "Neplatný režim spoření." };
  if (value === null || value < 0) return { error: "Spoření musí být číslo." };
  if (mode === "percent" && value > 100) return { error: "Procenta můžou být nejvýš 100." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("households")
    .update({
      savings_mode: mode,
      // Stored in haléře as an amount, plain percent otherwise — the mode is
      // what says which, and the two always travel together.
      savings_value: mode === "amount" ? czkToHalere(value) : value,
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null, notice: "Spoření uloženo." };
}

export async function rotateJoinCode(householdId: string): Promise<void> {
  const supabase = await createClient();
  await supabase.rpc("rotate_join_code", { p_household: householdId });
  revalidatePath("/nastaveni");
}

export async function leaveHousehold(householdId: string): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("memberships")
    .delete()
    .eq("household_id", householdId)
    .eq("user_id", user.id);

  revalidatePath("/", "layout");
}
