/**
 * Money is an integer number of haléře everywhere in Numulo. These helpers are
 * the only place the ×100 conversion is allowed to happen.
 */

export const HALERE_PER_CZK = 100;

/** U+202F. The spec asks for a narrow no-break space between thousands. */
const NARROW_NBSP = " ";
/** U+2212. A real minus sign, not a hyphen — it aligns with the digits. */
const MINUS = "−";

export function czkToHalere(czk: number): number {
  return Math.round(czk * HALERE_PER_CZK);
}

export function halereToCzk(halere: number): number {
  return halere / HALERE_PER_CZK;
}

/**
 * "12 345" with narrow no-break spaces, no decimals.
 *
 * Intl gives cs-CZ a regular no-break space (U+00A0); the design calls for the
 * narrow one, so it is substituted here rather than hand-rolling the grouping.
 */
export function formatNumber(czk: number): string {
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 })
    .format(Math.abs(czk))
    .replace(/[\s  ]/g, NARROW_NBSP);
}

export interface FormatOptions {
  /** Show a leading + for positives — used in the charts. */
  sign?: boolean;
  /** Append " Kč". Off where the unit is rendered as its own element. */
  unit?: boolean;
}

/**
 * The single money formatter. Takes haléře, returns what the UI shows.
 *
 * Rounds to whole crowns: haléře are noise in every number Numulo displays,
 * and a stray "12 345,67" would break the mono column alignment the design
 * relies on.
 */
export function formatCzk(halere: number, options: FormatOptions = {}): string {
  const czk = Math.round(halereToCzk(halere));
  const body = formatNumber(czk);
  const prefix = czk < 0 ? MINUS : options.sign && czk > 0 ? "+" : "";
  return `${prefix}${body}${options.unit === false ? "" : `${NARROW_NBSP}Kč`}`;
}

/**
 * "12 k" for chart axis labels — "2,5 k" when the step is a half.
 *
 * The nice-step series the axes draw from contains 2 500 and 12 500, so
 * rounding to whole thousands would label two different gridlines "3 k" and
 * make the axis unreadable.
 */
export function formatCompact(halere: number): string {
  const czk = Math.round(halereToCzk(halere));
  if (czk === 0) return "0";

  const thousands = Math.abs(czk) / 1000;
  const body =
    thousands >= 10 || Number.isInteger(thousands)
      ? String(Math.round(thousands))
      : thousands.toFixed(1).replace(".", ",").replace(",0", "");

  return `${czk < 0 ? MINUS : ""}${body}${NARROW_NBSP}k`;
}

/**
 * Parses Czech-formatted amounts from CSV exports: decimal comma, spaces
 * (regular, narrow and non-breaking) as thousands separators.
 * Returns haléře, or null when the input is not a number.
 */
export function parseCzkAmount(input: string): number | null {
  const cleaned = input
    .replace(/[\s   ]/g, "")
    .replace(/−/g, "-")
    .replace(",", ".")
    .trim();
  if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return czkToHalere(Number(cleaned));
}
