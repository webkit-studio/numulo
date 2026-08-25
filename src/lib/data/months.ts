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
export interface MonthOptions {
  /** Every month the picker offers, newest first. */
  all: IsoMonth[];
  /** The newest month that actually has transactions. */
  newestWithData: IsoMonth | null;
}

export async function getMonthsWithData(
  householdId: string,
  today: string,
): Promise<MonthOptions> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("transactions")
    .select("date")
    .eq("household_id", householdId)
    .order("date", { ascending: false });

  const withData = [...new Set((data ?? []).map((row) => monthOf(row.date as string)))]
    .sort()
    .reverse();

  // The current month is always offered even before anything lands in it,
  // otherwise the picker disappears on the 1st of the month.
  const all = [...new Set([monthOf(today), ...withData])].sort().reverse();

  return { all, newestWithData: withData[0] ?? null };
}

/**
 * Which month to show.
 *
 * Defaults to the newest month that has data rather than to today. Opening on
 * an empty current month shows a screen full of zeroes that look like a
 * household which stopped spending, when really the statement simply has not
 * been imported yet.
 */
export function resolveMonth(
  requested: string | string[] | undefined,
  months: MonthOptions,
  today: string,
): IsoMonth {
  if (typeof requested === "string" && months.all.includes(requested)) return requested;
  return months.newestWithData ?? monthOf(today);
}
