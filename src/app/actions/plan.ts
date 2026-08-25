"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { czkToHalere } from "@/lib/money";

/**
 * The two things on Plán that are not list rows: a category's limit, and
 * whether a category shows up in the envelopes at all.
 *
 * Turning a limit off is a null, not a zero. A zero limit would mean "you may
 * spend nothing here" and would paint the envelope red the moment anyone did;
 * null means nobody has decided yet, which is the honest state.
 */

export interface LimitResult {
  error: string | null;
  notice?: string;
}

export async function setCategoryLimit(
  categoryId: string,
  name: string,
  czk: string | null,
): Promise<LimitResult> {
  let limit: number | null = null;

  if (czk !== null && czk.trim() !== "") {
    const value = Number(czk.replace(",", ".").replace(/[\s ]/g, ""));
    if (!Number.isFinite(value) || value < 0) return { error: "Limit musí být číslo." };
    limit = czkToHalere(value);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("categories")
    .update({ monthly_limit: limit })
    .eq("id", categoryId);

  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return {
    error: null,
    notice: limit === null ? `${name} — limit zrušen` : `${name} — limit uložen`,
  };
}
