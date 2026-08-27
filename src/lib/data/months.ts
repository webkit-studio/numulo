import { cache } from "react";
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

export const getMonthsWithData = cache(async (
  householdId: string,
  today: string,
): Promise<MonthOptions> => {
  const supabase = await createClient();
  // One row instead of one row per transaction — the function is SECURITY
  // INVOKER, so RLS still answers who may ask.
  const { data } = await supabase.rpc("months_with_data", { p_household: householdId });

  const withData = ((data ?? []) as IsoMonth[]).slice().sort().reverse();

  // The current month is always offered even before anything lands in it,
  // otherwise the picker disappears on the 1st of the month.
  const all = [...new Set([monthOf(today), ...withData])].sort().reverse();

  return { all, newestWithData: withData[0] ?? null };
});

/**
 * Which month to show: the current one, always.
 *
 * An earlier version defaulted to the newest month *with data*, which read as
 * helpful until it opened July on the 26th of August. The question a person
 * brings to a budget is "how are we doing NOW" — a stale month answers a
 * question nobody asked, and the freshness note under the heading already
 * says when the statement ends.
 */
export function resolveMonth(
  requested: string | string[] | undefined,
  today: string,
): IsoMonth {
  // Format check only — validating against the month LIST would force the
  // list to load before anything else, serialising two round trips that can
  // run side by side. A well-formed month with no data renders as empty,
  // which is also the correct answer.
  if (typeof requested === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(requested)) {
    return requested;
  }
  return monthOf(today);
}
