"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { czkToHalere } from "@/lib/money";
import { LISTS, isListKey, type FieldSpec, type ListKey } from "@/lib/lists/registry";

/**
 * Create, edit and delete for every list in the registry.
 *
 * Three actions instead of fifteen. The list key selects a table from the
 * registry — a value the caller cannot invent — and the field specs say how to
 * read each input. Row-level security decides whose rows these are; this file
 * only decides whether "20." is a day of the month (it is) and whether "" is a
 * budget (it is not).
 */

export interface ListResult {
  error: string | null;
  /** What the toast should say. */
  notice?: string;
}

function parseField(field: FieldSpec, raw: string): number | string | null | undefined {
  const value = raw.trim();

  if (value === "") {
    if (field.optional) return null;
    return undefined; // missing but required
  }

  switch (field.kind) {
    case "text":
      return value;

    case "money": {
      const czk = Number(value.replace(",", ".").replace(/[\s ]/g, ""));
      return Number.isFinite(czk) ? czkToHalere(czk) : undefined;
    }

    case "day": {
      const day = Number(value.replace(".", ""));
      return Number.isInteger(day) && day >= 1 && day <= 31 ? day : undefined;
    }

    case "monthNumber": {
      const month = Number(value.replace(".", ""));
      return Number.isInteger(month) && month >= 1 && month <= 12 ? month : undefined;
    }

    case "month":
      return /^\d{4}-\d{2}$/.test(value) ? value : undefined;

    case "choice":
      return field.options?.some((option) => option.value === value) ? value : undefined;
  }
}

/** Reads every field of a list out of the form, or names the first bad one. */
type ReadResult =
  | { values: Record<string, unknown>; error: null }
  | { values: null; error: string };

function readRow(key: ListKey, form: FormData): ReadResult {
  const spec = LISTS[key];
  const values: Record<string, unknown> = {};

  for (const field of spec.fields) {
    const parsed = parseField(field, String(form.get(field.key) ?? ""));
    if (parsed === undefined) {
      return { values: null, error: `Zkontroluj pole „${field.label}“.` };
    }
    values[field.key] = parsed;
  }

  return { values, error: null };
}

const title = (key: ListKey, values: Record<string, unknown>) =>
  String(values[LISTS[key].titleField] ?? "");

/** Everything a list can change moves a number on some other screen. */
function refresh(): void {
  revalidatePath("/", "layout");
}

export async function addListItem(_prev: ListResult, form: FormData): Promise<ListResult> {
  const key = String(form.get("list") ?? "");
  if (!isListKey(key)) return { error: "Neznámý seznam." };

  const householdId = String(form.get("householdId") ?? "");
  const row = readRow(key, form);
  if (row.values === null) return { error: row.error };

  const spec = LISTS[key];
  const supabase = await createClient();
  const { error } = await supabase
    .from(spec.table)
    .insert({ ...spec.defaults, ...row.values, household_id: householdId });

  if (error) return { error: error.message };

  refresh();
  return { error: null, notice: `${spec.noun} přidáno: ${title(key, row.values)}` };
}

export async function updateListItem(_prev: ListResult, form: FormData): Promise<ListResult> {
  const key = String(form.get("list") ?? "");
  if (!isListKey(key)) return { error: "Neznámý seznam." };

  const id = String(form.get("id") ?? "");
  const row = readRow(key, form);
  if (row.values === null) return { error: row.error };

  const spec = LISTS[key];
  const supabase = await createClient();
  const { error } = await supabase.from(spec.table).update(row.values).eq("id", id);

  if (error) return { error: error.message };

  refresh();
  return { error: null, notice: `${title(key, row.values)} — uloženo` };
}

/**
 * Deletes for real, rather than flipping an `active` flag.
 *
 * A payment someone removed should stop existing: leaving it behind as an
 * inactive row means it keeps turning up in every query that forgets the
 * filter. Simulating a cancelled subscription is a different thing entirely,
 * and lives in its own action.
 */
export async function removeListItem(key: string, id: string, name: string): Promise<ListResult> {
  if (!isListKey(key)) return { error: "Neznámý seznam." };

  const supabase = await createClient();
  const { error } = await supabase.from(LISTS[key].table).delete().eq("id", id);

  if (error) return { error: error.message };

  refresh();
  return { error: null, notice: `${LISTS[key].noun} odebráno: ${name}` };
}
