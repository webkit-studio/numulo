import { createClient } from "@/lib/supabase/server";
import { LISTS, type ListKey } from "@/lib/lists/registry";

/** How each list reads best: by when it is due, then by name. */
const ORDER: Record<ListKey, { column: string; ascending?: boolean }[]> = {
  subscriptions: [{ column: "day" }, { column: "name" }],
  monthly: [{ column: "day" }, { column: "name" }],
  yearly: [{ column: "due_month" }, { column: "name" }],
  planned: [{ column: "direction" }, { column: "name" }],
  debts: [{ column: "remaining_amount", ascending: false }],
};

export type ListRow = Record<string, unknown> & { id: string };

export async function getListRows(householdId: string, key: ListKey): Promise<ListRow[]> {
  const supabase = await createClient();
  let query = supabase.from(LISTS[key].table).select("*").eq("household_id", householdId);
  for (const { column, ascending = true } of ORDER[key]) {
    query = query.order(column, { ascending, nullsFirst: false });
  }
  const { data } = await query;
  return (data ?? []) as ListRow[];
}
