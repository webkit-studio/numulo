/**
 * Dates are ISO strings: `YYYY-MM-DD` for days, `YYYY-MM` for months. Both sort
 * and compare lexicographically, which is what every calculation relies on —
 * no Date objects, no timezone surprises on the edge runtime.
 */

export type IsoDate = string; // YYYY-MM-DD
export type IsoMonth = string; // YYYY-MM

export function monthOf(date: IsoDate): IsoMonth {
  return date.slice(0, 7);
}

export function isInMonth(date: IsoDate, month: IsoMonth): boolean {
  return date.startsWith(month);
}

/** 1–12 */
export function monthNumber(month: IsoMonth): number {
  return Number(month.slice(5, 7));
}

export function yearOf(month: IsoMonth): number {
  return Number(month.slice(0, 4));
}

export function makeMonth(year: number, month: number): IsoMonth {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function addMonths(month: IsoMonth, delta: number): IsoMonth {
  const total = yearOf(month) * 12 + (monthNumber(month) - 1) + delta;
  return makeMonth(Math.floor(total / 12), (total % 12) + 1);
}

/** Inclusive on both ends. */
export function monthRange(from: IsoMonth, to: IsoMonth): IsoMonth[] {
  const months: IsoMonth[] = [];
  for (let cursor = from; cursor <= to; cursor = addMonths(cursor, 1)) {
    months.push(cursor);
  }
  return months;
}

/** The `count` months ending at `month` (inclusive), oldest first. */
export function lastMonths(month: IsoMonth, count: number): IsoMonth[] {
  return monthRange(addMonths(month, -(count - 1)), month);
}

export function daysInMonth(month: IsoMonth): number {
  return new Date(Date.UTC(yearOf(month), monthNumber(month), 0)).getUTCDate();
}

export function dayOf(date: IsoDate): number {
  return Number(date.slice(8, 10));
}
