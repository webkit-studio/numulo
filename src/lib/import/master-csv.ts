import { parseCzkAmount } from "@/lib/money";
import type { FingerprintParts } from "./fingerprint";

/**
 * Profile for the master CSV — the pre-merged seven months of history that
 * seeds numo. UTF-8 with BOM, semicolon-delimited, CRLF, 16 columns, no
 * quoting. Everything in it predates the real bank imports.
 */
export const MASTER_CSV_PROFILE = {
  name: "numo-master",
  delimiter: ";",
  encoding: "utf-8",
  skipRows: 0,
  columns: [
    "datum",
    "datum_provedeni",
    "obdobi",
    "ucet_cislo",
    "ucet_nazev",
    "typ",
    "protistrana",
    "popis",
    "karta",
    "kdo",
    "protiucet",
    "castka",
    "poplatek",
    "castka_celkem",
    "interni_prevod",
    "zdroj_souboru",
  ],
} as const;

export type MasterCsvRow = Record<string, string>;

/**
 * Card number → who spent it. Every card in the master CSV maps to exactly one
 * person, so the 26 rows where `kdo` is blank but a card is present can be
 * attributed deterministically instead of being left unassigned.
 */
export const CARD_OWNERS: Record<string, string> = {
  "516844******2137": "Lukáš",
  "516844******2109": "Lukáš",
  "514878******1566": "Lukáš",
  "514878******8577": "Lukáš",
  "516844******2681": "Věrka",
  "516844******0180": "Věrka",
};

/**
 * Account number → category, for accounts that are themselves the answer.
 * "Společný účet - Jídlo" exists purely to hold food spending, so every row on
 * it is Jídlo without asking anyone.
 */
export const ACCOUNT_CATEGORIES: Record<string, string> = {
  "2053627033": "Jídlo",
};

/** Types where `popis` holds the merchant and `protistrana` the cardholder. */
const CARD_TYPES = new Set(["Platba kartou", "Výběr hotovosti", "Vrácení peněz"]);

export interface NormalizedRow {
  date: string;
  /** Haléře, signed. Includes the fee — `castka_celkem`, not `castka`. */
  amount: number;
  currency: "CZK";
  merchant: string | null;
  description: string;
  ownerName: string | null;
  isTransfer: boolean;
  categoryName: string | null;
  /** Which household bank account the row sits on. */
  ownAccount: string;
  counterAccount: string;
  vs: string;
  raw: MasterCsvRow;
}

export interface RowError {
  line: number;
  reason: string;
  raw: MasterCsvRow;
}

/** Collapses runs of whitespace; keeps case for display. */
function collapse(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

/**
 * The merchant, as far as a bank statement knows one. Card rows carry the shop
 * followed by its address — everything after the first comma is the address, so
 * cutting there gives something a merchant→category rule can actually match.
 */
function extractMerchant(row: MasterCsvRow): string | null {
  const type = row.typ ?? "";
  const source = CARD_TYPES.has(type) ? row.popis : row.protistrana;
  const cleaned = collapse(source ?? "");
  if (cleaned === "") return null;
  const beforeAddress = cleaned.split(",")[0];
  return collapse(beforeAddress) || cleaned;
}

/** Variabilní symbol, which this export keeps inside the description text. */
function extractVs(row: MasterCsvRow): string {
  const match = /VS\s?(\d{4,})/.exec(row.popis ?? "");
  return match ? match[1] : "";
}

export function normalizeMasterRow(
  row: MasterCsvRow,
  line: number,
): NormalizedRow | RowError {
  const date = collapse(row.datum ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { line, reason: `neplatné datum: ${row.datum ?? ""}`, raw: row };
  }

  // castka_celkem = castka + poplatek, verified across the whole file. Using
  // `castka` would quietly lose the ATM fees.
  const amount = parseCzkAmount(row.castka_celkem ?? "");
  if (amount === null) {
    return { line, reason: `neplatná částka: ${row.castka_celkem ?? ""}`, raw: row };
  }

  const description = collapse(row.popis ?? "") || collapse(row.protistrana ?? "");
  const ownerName =
    collapse(row.kdo ?? "") || CARD_OWNERS[collapse(row.karta ?? "")] || null;

  return {
    date,
    amount,
    currency: "CZK",
    merchant: extractMerchant(row),
    description,
    ownerName,
    isTransfer: collapse(row.interni_prevod ?? "").toLowerCase() === "ano",
    categoryName: ACCOUNT_CATEGORIES[collapse(row.ucet_cislo ?? "")] ?? null,
    ownAccount: collapse(row.ucet_cislo ?? ""),
    counterAccount: collapse(row.protiucet ?? ""),
    vs: extractVs(row),
    raw: row,
  };
}

/** Lowercased for hashing only — the stored description keeps its case. */
export function fingerprintPartsOf(row: NormalizedRow): FingerprintParts {
  return {
    date: row.date,
    amount: row.amount,
    currency: row.currency,
    counterAccount: row.counterAccount,
    vs: row.vs,
    normalizedDescription: row.description.toLowerCase(),
    ownAccount: row.ownAccount,
  };
}
