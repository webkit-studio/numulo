import Papa from "papaparse";
import { fingerprintAll } from "./fingerprint";
import {
  mapRow,
  type ColumnMap,
  type MappedRow,
  type MapRowError,
} from "./mapping";
import { sniffShape, type Shape } from "./sniff";

export interface PreparedRow extends MappedRow {
  fingerprint: string;
  /** Best guess at the shop or person on the other side. */
  merchant: string;
  line: number;
}

export interface PreparedFile {
  shape: Shape;
  rows: PreparedRow[];
  errors: MapRowError[];
}

/**
 * The merchant is whichever field actually names the other side.
 *
 * Card payments put the shop in the description and leave the counterparty
 * blank; bank transfers do the opposite. Picking one column for both loses
 * half the names, and a nameless row cannot be categorised or rule-matched.
 */
function merchantOf(row: MappedRow): string {
  const candidate = row.counterparty || row.description || "";
  // Statements pad the merchant with the address and terminal id; the part
  // before the first comma is the name.
  return candidate.split(",")[0].trim().slice(0, 120);
}

/** Parses an already-decoded statement into fingerprinted rows. */
export async function prepareFile(
  text: string,
  map: ColumnMap,
  shape?: Shape,
): Promise<PreparedFile> {
  const resolved = shape ?? sniffShape(text);

  const body =
    resolved.skipRows > 0
      ? text.split(/\r?\n/).slice(resolved.skipRows).join("\n")
      : text;

  const parsed = Papa.parse<Record<string, string>>(body, {
    delimiter: resolved.delimiter,
    header: true,
    skipEmptyLines: true,
  });

  const mapped: (MappedRow & { line: number })[] = [];
  const errors: MapRowError[] = [];

  parsed.data.forEach((raw, index) => {
    // +2 for the header row and 1-based counting, plus whatever was skipped —
    // so a reported line number matches what the file shows in a text editor.
    const line = index + 2 + resolved.skipRows;
    const result = mapRow(raw, map, line);
    if ("reason" in result) errors.push(result);
    else mapped.push({ ...result, line });
  });

  const fingerprints = await fingerprintAll(
    mapped.map((row) => ({
      date: row.date,
      amount: row.amount,
      currency: row.currency,
      counterAccount: row.counterAccount,
      vs: row.vs,
      normalizedDescription: row.description.toLowerCase().replace(/\s+/g, " ").trim(),
      // One statement is one account; rows from a second file get their own
      // fingerprints because their counter-accounts and descriptions differ.
      ownAccount: "",
    })),
  );

  return {
    shape: resolved,
    errors,
    rows: mapped.map((row, index) => ({
      ...row,
      fingerprint: fingerprints[index],
      merchant: merchantOf(row),
    })),
  };
}

export type RowVerdict = "duplicate" | "review" | "new";

export interface ClassifiedRow extends PreparedRow {
  verdict: RowVerdict;
  /** Category the stored rules chose, when they could. */
  categoryId: number | null;
  categoryName: string | null;
  ownerId: number | null;
  isTransfer: boolean;
  /** Why the row needs a human, when it does. */
  note: string | null;
}

export interface ClassifyInput {
  rows: readonly PreparedRow[];
  /** Fingerprints already in the database. */
  known: ReadonlySet<string>;
  /** merchant-lowercase → category, from the rules table. */
  categoryRules: ReadonlyMap<string, { id: number; name: string }>;
  transferPatterns: readonly string[];
  ownerRules: ReadonlyMap<string, number>;
}

/**
 * Sorts every row into one of the three tabs.
 *
 * Duplicates are decided by fingerprint alone — the same test the database
 * uses — so what the screen promises and what the insert does can never
 * disagree. Everything else lands in "ke schválení" unless a stored rule can
 * name its category, because a row with no category is exactly the row that
 * needs looking at.
 */
export function classifyRows(input: ClassifyInput): ClassifiedRow[] {
  const seenInFile = new Set<string>();

  return input.rows.map((row) => {
    const merchant = row.merchant.toLowerCase();

    if (input.known.has(row.fingerprint) || seenInFile.has(row.fingerprint)) {
      return {
        ...row,
        verdict: "duplicate" as const,
        categoryId: null,
        categoryName: null,
        ownerId: null,
        isTransfer: false,
        note: "už v numo je",
      };
    }
    seenInFile.add(row.fingerprint);

    const rule = [...input.categoryRules.entries()].find(([pattern]) =>
      merchant.includes(pattern),
    );
    const owner = [...input.ownerRules.entries()].find(([pattern]) =>
      merchant.includes(pattern) || row.card.includes(pattern),
    );
    const isTransfer = input.transferPatterns.some((pattern) =>
      merchant.includes(pattern),
    );

    return {
      ...row,
      verdict: rule ? ("new" as const) : ("review" as const),
      categoryId: rule?.[1].id ?? null,
      categoryName: rule?.[1].name ?? null,
      ownerId: owner?.[1] ?? null,
      isTransfer,
      note: rule ? null : "žádné pravidlo pro tohohle obchodníka",
    };
  });
}

export interface ImportSummary {
  total: number;
  duplicates: number;
  review: number;
  ready: number;
  errors: number;
  /** Control totals per month, so the import can be checked against the bank. */
  months: { month: string; rows: number; income: number; expenses: number }[];
}

export function summarise(
  rows: readonly ClassifiedRow[],
  errors: readonly MapRowError[],
): ImportSummary {
  const months = new Map<string, { month: string; rows: number; income: number; expenses: number }>();

  for (const row of rows) {
    if (row.verdict === "duplicate") continue;
    const month = row.date.slice(0, 7);
    const totals = months.get(month) ?? { month, rows: 0, income: 0, expenses: 0 };
    totals.rows += 1;
    if (row.amount > 0) totals.income += row.amount;
    else totals.expenses -= row.amount;
    months.set(month, totals);
  }

  return {
    total: rows.length,
    duplicates: rows.filter((row) => row.verdict === "duplicate").length,
    review: rows.filter((row) => row.verdict === "review").length,
    ready: rows.filter((row) => row.verdict === "new").length,
    errors: errors.length,
    months: [...months.values()].sort((a, b) => a.month.localeCompare(b.month)),
  };
}
