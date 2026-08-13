import { daysInMonth, dayOf, monthOf, type IsoDate, type IsoMonth } from "@/lib/date";

/**
 * ⚠ PROVISIONAL — spec §4 is binding for this and has not arrived yet.
 *
 * The formula implemented here is the plain reading of "zbývá na útratu ÷ kolik
 * dní zbývá": what is left of the monthly ceiling, spread evenly over the rest
 * of the month, today included. The ⓘ panel in the UI states it verbatim so the
 * number never looks more authoritative than it is.
 *
 * Replace once §4 lands; the tests here pin the current behaviour so the swap
 * is visible in the diff.
 */

export interface DailyLimitInput {
  month: IsoMonth;
  budget: number;
  spent: number;
  /** Reference day. Only its position inside the month matters. */
  today: IsoDate;
}

export interface DailyLimit {
  /** Spendable per remaining day. Null for a month that is already over. */
  perDay: number | null;
  daysLeft: number;
  remaining: number;
  /** What was actually spent per elapsed day — the reality check next to it. */
  averageSoFar: number | null;
  /** True when spending already exceeds the ceiling. */
  overspent: boolean;
}

export function computeDailyLimit(input: DailyLimitInput): DailyLimit {
  const total = daysInMonth(input.month);
  const remaining = input.budget - input.spent;
  const currentMonth = monthOf(input.today);

  let daysLeft: number;
  let elapsed: number;

  if (currentMonth < input.month) {
    // A month that has not started: the whole of it is ahead.
    daysLeft = total;
    elapsed = 0;
  } else if (currentMonth > input.month) {
    daysLeft = 0;
    elapsed = total;
  } else {
    const day = Math.min(dayOf(input.today), total);
    daysLeft = total - day + 1;
    elapsed = day;
  }

  return {
    perDay: daysLeft > 0 ? Math.round(remaining / daysLeft) : null,
    daysLeft,
    remaining,
    averageSoFar: elapsed > 0 ? Math.round(input.spent / elapsed) : null,
    overspent: remaining < 0,
  };
}
