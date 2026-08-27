import { parseCzkAmount } from "@/lib/money";

/**
 * Which column holds what.
 *
 * Every field is a header name from the file, or null when the export does not
 * carry it. Only `date` and one of the amount fields are actually required —
 * everything else improves the result without being needed for it.
 */
export interface ColumnMap {
  date: string | null;
  /** Signed amount in one column: negative is spending. */
  amount: string | null;
  /** Or two columns, the way some exports split debit and credit. */
  debit: string | null;
  credit: string | null;
  currency: string | null;
  description: string | null;
  counterparty: string | null;
  counterAccount: string | null;
  vs: string | null;
  /** Card number or holder — how a row gets attributed to a person. */
  card: string | null;
}

export const EMPTY_MAP: ColumnMap = {
  date: null,
  amount: null,
  debit: null,
  credit: null,
  currency: null,
  description: null,
  counterparty: null,
  counterAccount: null,
  vs: null,
  card: null,
};

/**
 * Header words that identify each field, most specific first.
 *
 * Matching is on a normalised header (lowercased, diacritics stripped) so
 * "Datum zaúčtování" and "datum zauctovani" are the same thing — bank exports
 * are inconsistent about accents even within one file.
 */
const PATTERNS: { field: keyof ColumnMap; words: string[] }[] = [
  // "datum splatnosti" is deliberately absent: on a statement that is a
  // standing order's due date, not the day the money moved.
  { field: "date", words: ["datum uskutecneni", "datum zauctovani", "datum provedeni", "completed date", "started date", "datum", "date"] },
  // "objem" is Fio's word for the signed amount, "obrat" is ČSOB's.
  { field: "amount", words: ["castka celkem", "castka v mene uctu", "castka", "objem", "obrat", "amount", "suma", "hodnota"] },
  { field: "debit", words: ["vydaj", "debet", "ma dati", "paid out", "withdrawal"] },
  { field: "credit", words: ["prijem", "kredit", "dal", "paid in", "deposit"] },
  { field: "currency", words: ["mena", "currency"] },
  { field: "description", words: ["popis", "poznamka", "zprava pro prijemce", "detail", "description", "reference", "upresneni"] },
  // "nazev protiuctu" belongs here, not with description: it names the other
  // side of the payment, which is exactly what a merchant is. Leaving it on
  // description let it claim the column first and the merchant came out blank.
  { field: "counterparty", words: ["nazev protiuctu", "protistrana", "nazev protistrany", "prijemce", "obchodnik", "merchant", "payee", "beneficiary"] },
  { field: "counterAccount", words: ["protiucet", "cislo protiuctu", "ucet protistrany", "counter account", "iban"] },
  { field: "vs", words: ["variabilni symbol", "vs", "variable symbol"] },
  { field: "card", words: ["cislo karty", "karta", "card number", "drzitel karty", "card"] },
];

export function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Guesses the mapping from header names alone.
 *
 * Deliberately the first thing tried: for every export a Czech bank produces
 * this gets it right, costs nothing and cannot hallucinate. AI is the fallback
 * for the file this does not recognise, not the default path.
 */
export function guessColumnMap(headers: readonly string[]): ColumnMap {
  const map: ColumnMap = { ...EMPTY_MAP };
  const normalized = headers.map(normalizeHeader);
  const taken = new Set<number>();

  // Three passes, loosest last. A column named exactly "Datum" has to beat
  // "Datum splatnosti příkazu" no matter which order they appear in the file,
  // so every field gets its exact match before any field gets a fuzzy one.
  const passes: ((header: string, word: string) => boolean)[] = [
    (header, word) => header === word,
    (header, word) => header.startsWith(`${word} `),
    (header, word) => header.includes(word),
  ];

  for (const matches of passes) {
    for (const { field, words } of PATTERNS) {
      if (map[field] !== null) continue;
      for (const word of words) {
        const index = normalized.findIndex(
          (header, position) => !taken.has(position) && matches(header, word),
        );
        if (index !== -1) {
          map[field] = headers[index];
          taken.add(index);
          break;
        }
      }
    }
  }

  return map;
}

export interface MapProblem {
  field: keyof ColumnMap;
  message: string;
}

/** What is still missing before the file can be read at all. */
export function validateColumnMap(map: ColumnMap): MapProblem[] {
  const problems: MapProblem[] = [];

  if (!map.date) {
    problems.push({ field: "date", message: "Chybí sloupec s datem." });
  }
  if (!map.amount && !map.debit && !map.credit) {
    problems.push({
      field: "amount",
      message: "Chybí sloupec s částkou (nebo dvojice příjem/výdaj).",
    });
  }

  return problems;
}

/* ------------------------------------------------------------------ dates */

/**
 * Parses the date formats Czech exports actually use.
 *
 * Ambiguity between DD/MM and MM/DD is resolved in favour of DD/MM: every bank
 * exporting to a Czech customer writes day first, and an American reading
 * would silently move a payment by up to eleven months.
 */
export function parseStatementDate(input: string): string | null {
  const text = input.trim();
  if (text === "") return null;

  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const dotted = text.match(/^(\d{1,2})\s*[.\/-]\s*(\d{1,2})\s*[.\/-]\s*(\d{2,4})/);
  if (dotted) {
    const day = dotted[1].padStart(2, "0");
    const month = dotted[2].padStart(2, "0");
    const year = dotted[3].length === 2 ? `20${dotted[3]}` : dotted[3];
    if (Number(month) >= 1 && Number(month) <= 12 && Number(day) >= 1 && Number(day) <= 31) {
      return `${year}-${month}-${day}`;
    }
  }

  return null;
}

/* ------------------------------------------------------------------- rows */

export interface MappedRow {
  date: string;
  /** Haléře, negative for spending. */
  amount: number;
  currency: string;
  description: string;
  counterparty: string;
  counterAccount: string;
  vs: string;
  card: string;
}

export interface MapRowError {
  line: number;
  reason: string;
  raw: Record<string, string>;
}

const value = (row: Record<string, string>, column: string | null): string =>
  column === null ? "" : (row[column] ?? "").trim();

/**
 * Turns one raw CSV row into the shape Numulo stores.
 *
 * A row that cannot be read is returned as an error rather than skipped:
 * a statement that quietly loses three lines is worse than one that refuses
 * to import, because the totals will be wrong and nothing will say so.
 */
export function mapRow(
  raw: Record<string, string>,
  map: ColumnMap,
  line: number,
): MappedRow | MapRowError {
  const date = parseStatementDate(value(raw, map.date));
  if (date === null) {
    return { line, reason: "Nečitelné datum", raw };
  }

  let amount: number | null = null;

  if (map.amount) {
    amount = parseCzkAmount(value(raw, map.amount));
  } else {
    const debit = parseCzkAmount(value(raw, map.debit)) ?? 0;
    const credit = parseCzkAmount(value(raw, map.credit)) ?? 0;
    // Split columns are printed unsigned; the column itself carries the sign.
    amount = credit !== 0 ? Math.abs(credit) : -Math.abs(debit);
  }

  if (amount === null) {
    return { line, reason: "Nečitelná částka", raw };
  }
  if (amount === 0) {
    return { line, reason: "Nulová částka", raw };
  }

  return {
    date,
    amount,
    currency: value(raw, map.currency) || "CZK",
    description: value(raw, map.description),
    counterparty: value(raw, map.counterparty),
    counterAccount: value(raw, map.counterAccount),
    vs: value(raw, map.vs),
    card: value(raw, map.card),
  };
}
