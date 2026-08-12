import Papa from "papaparse";
import {
  MASTER_CSV_PROFILE,
  fingerprintPartsOf,
  normalizeMasterRow,
  type MasterCsvRow,
  type NormalizedRow,
  type RowError,
} from "./master-csv";
import { fingerprintAll } from "./fingerprint";

export interface ParsedMasterCsv {
  rows: (NormalizedRow & { fingerprint: string })[];
  errors: RowError[];
}

/**
 * Parses the master CSV into normalised, fingerprinted rows.
 *
 * Takes an already-decoded string: decoding belongs to the caller, because the
 * real bank exports need their own decoder (Air Bank is windows-1250) before
 * PapaParse ever sees them.
 */
export async function parseMasterCsv(text: string): Promise<ParsedMasterCsv> {
  // The file is UTF-8 with a BOM; left in place it becomes part of the first
  // header name and every lookup on that column silently returns undefined.
  const withoutBom = text.replace(/^﻿/, "");

  const parsed = Papa.parse<MasterCsvRow>(withoutBom, {
    delimiter: MASTER_CSV_PROFILE.delimiter,
    header: true,
    skipEmptyLines: true,
  });

  const normalized: NormalizedRow[] = [];
  const errors: RowError[] = [];

  parsed.data.forEach((raw, index) => {
    const result = normalizeMasterRow(raw, index + 2); // +2: header plus 1-based
    if ("reason" in result) errors.push(result);
    else normalized.push(result);
  });

  const fingerprints = await fingerprintAll(normalized.map(fingerprintPartsOf));

  return {
    rows: normalized.map((row, index) => ({
      ...row,
      fingerprint: fingerprints[index],
    })),
    errors,
  };
}

export interface MonthTotals {
  month: string;
  rows: number;
  income: number;
  expenses: number;
  transfers: number;
}

/**
 * Control totals for the sanity check against the source statements.
 * Transfers are counted but kept out of income and expenses.
 */
export function monthlyTotals(
  rows: readonly (NormalizedRow & { fingerprint: string })[],
): MonthTotals[] {
  const byMonth = new Map<string, MonthTotals>();

  for (const row of rows) {
    const month = row.date.slice(0, 7);
    const totals = byMonth.get(month) ?? {
      month,
      rows: 0,
      income: 0,
      expenses: 0,
      transfers: 0,
    };
    totals.rows += 1;
    if (row.isTransfer) totals.transfers += 1;
    else if (row.amount > 0) totals.income += row.amount;
    else totals.expenses -= row.amount;
    byMonth.set(month, totals);
  }

  return [...byMonth.values()].sort((a, b) => a.month.localeCompare(b.month));
}
