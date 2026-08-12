/**
 * Money is an integer number of haléře everywhere in numo. These helpers are
 * the only place where the ×100 conversion is allowed to happen.
 */

export const HALERE_PER_CZK = 100;

export function czkToHalere(czk: number): number {
  return Math.round(czk * HALERE_PER_CZK);
}

export function halereToCzk(halere: number): number {
  return halere / HALERE_PER_CZK;
}

const wholeCzkFormatter = new Intl.NumberFormat("cs-CZ", {
  maximumFractionDigits: 0,
});

const preciseCzkFormatter = new Intl.NumberFormat("cs-CZ", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * "63 000 Kč". Rounds to whole crowns — haléře are noise in every household
 * number numo shows. Pass `precise` where the exact amount matters (import
 * review, transaction detail).
 */
export function formatCzk(
  halere: number,
  options: { precise?: boolean; sign?: boolean } = {},
): string {
  const czk = halereToCzk(halere);
  const formatter = options.precise ? preciseCzkFormatter : wholeCzkFormatter;
  const body = formatter.format(Math.abs(czk));
  const sign = halere < 0 ? "−" : options.sign ? "+" : "";
  // U+00A0 keeps "63 000 Kč" from wrapping between number and unit.
  return `${sign}${body} Kč`;
}

/**
 * Parses Czech-formatted amounts from CSV exports: decimal comma, spaces
 * (including non-breaking and narrow no-break) as thousands separators.
 * Returns haléře, or null when the input isn't a number.
 */
export function parseCzkAmount(input: string): number | null {
  const cleaned = input
    .replace(/[\s  ]/g, "")
    .replace(/−/g, "-") // U+2212 MINUS SIGN
    .replace(",", ".")
    .trim();
  if (cleaned === "" || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return czkToHalere(Number(cleaned));
}
