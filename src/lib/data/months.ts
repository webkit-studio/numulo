import { createClient } from "@/lib/supabase/server";
import { monthOf, type IsoMonth } from "@/lib/date";

/** Today as an ISO date in Prague, where the household actually lives. */
export function todayIso(): string {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Prague" }).format(new Date());
}

/**
 * Months the household has data for, newest first.
 *
 * Distinct months are derived in JS rather than SQL because Postgres cannot
 * index a to_char() expression without an immutable wrapper, and a household's
 * history is small enough that the round trip is cheaper than the machinery.
 */
export async function getMonthsWithData(
  householdId: string,
  today: string,
): Promise<IsoMonth[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("date")
    .eq("household_id", householdId)
    .order("date", { ascending: false });

  const months = new Set((data ?? []).map((row) => monthOf(row.date as string)));
  // The current month is always offered, even before anything lands in it —
  // otherwise the picker vanishes on the 1st.
  months.add(monthOf(today));

  return [...months].sort().reverse();
}

/** The requested month if the household has it, else the newest one. */
export function resolveMonth(
  requested: string | string[] | undefined,
  months: IsoMonth[],
  today: string,
): IsoMonth {
  if (typeof requested === "string" && months.includes(requested)) return requested;
  return months[0] ?? monthOf(today);
}
