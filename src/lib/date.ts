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

/** First day of the month, as an ISO date — the start of a half-open range. */
export function monthStart(month: IsoMonth): IsoDate {
  return `${month}-01`;
}

/** Last day of the month, inclusive. */
export function monthEnd(month: IsoMonth): IsoDate {
  return `${month}-${String(daysInMonth(month)).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "leden", "únor", "březen", "duben", "květen", "červen",
  "červenec", "srpen", "září", "říjen", "listopad", "prosinec",
];

/** "říjen 2026" */
export function monthLabel(month: IsoMonth): string {
  return `${MONTH_NAMES[monthNumber(month) - 1] ?? month} ${yearOf(month)}`;
}

/** "říjen" — used where the year is already obvious from context. */
export function monthNameOnly(month: IsoMonth): string {
  return MONTH_NAMES[monthNumber(month) - 1] ?? month;
}

/** "21. 10." — the compact form the freshness indicator uses. */
export function shortDate(date: IsoDate): string {
  return `${Number(date.slice(8, 10))}. ${Number(date.slice(5, 7))}.`;
}

const WEEKDAYS = ["neděle", "pondělí", "úterý", "středa", "čtvrtek", "pátek", "sobota"];

/**
 * "dnes" / "včera" / "pondělí 19. října" — how the transaction list groups days.
 * Relative labels only reach back two days; past that a weekday and date is
 * both shorter to read and easier to locate in a statement.
 */
export function dayHeading(date: IsoDate, today: IsoDate): string {
  if (date === today) return "dnes";

  const asDate = new Date(`${date}T00:00:00Z`);
  const todayDate = new Date(`${today}T00:00:00Z`);
  const diff = Math.round((todayDate.getTime() - asDate.getTime()) / 86_400_000);
  if (diff === 1) return "včera";

  const weekday = WEEKDAYS[asDate.getUTCDay()];
  const genitive = [
    "ledna", "února", "března", "dubna", "května", "června",
    "července", "srpna", "září", "října", "listopadu", "prosince",
  ][asDate.getUTCMonth()];

  return `${weekday} ${asDate.getUTCDate()}. ${genitive}`;
}
