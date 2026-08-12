import { count, eq } from "drizzle-orm";
import type { Db } from "@/db/getDb";
import {
  categories,
  importBatches,
  transactions,
  users,
  accounts,
} from "@/db/schema";
import { monthlyTotals, parseMasterCsv, type MonthTotals } from "./parse";

export interface SeedImportResult {
  filename: string;
  batchId: number;
  parsed: number;
  inserted: number;
  skippedAsDuplicate: number;
  errors: { line: number; reason: string }[];
  withOwner: number;
  withCategory: number;
  transfers: number;
  /** Latest date in the file — the cut-off the real bank imports start after. */
  lastDate: string | null;
  totals: MonthTotals[];
}

/**
 * D1 allows at most 100 bound parameters per query and each row binds 15
 * columns, so six rows per INSERT is the ceiling. The statements are then sent
 * in batches to keep 1300 rows down to a handful of round trips.
 */
const ROWS_PER_INSERT = 6;
const INSERTS_PER_BATCH = 20;

/**
 * One-off seed of the master CSV: seven months of pre-merged history.
 *
 * Treated differently from a normal statement import on purpose. Everything in
 * it is history — it feeds averages, trends and Vývoj, and must not move
 * Rezerva, which starts from the balance entered in Nastavení. The real bank
 * imports pick up after the last date here, so the two never overlap and their
 * differently-normalised fingerprints never have to agree.
 */
export async function runSeedImport(
  db: Db,
  accountId: number,
  filename: string,
  text: string,
  storageKey: string | null = null,
): Promise<SeedImportResult> {
  const { rows, errors } = await parseMasterCsv(text);

  const [userRows, categoryRows] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users),
    db
      .select({ id: categories.id, name: categories.name })
      .from(categories)
      .where(eq(categories.accountId, accountId)),
  ]);
  const userByName = new Map(userRows.map((u) => [u.name, u.id]));
  const categoryByName = new Map(categoryRows.map((c) => [c.name, c.id]));

  const [batch] = await db
    .insert(importBatches)
    .values({
      accountId,
      filename,
      storageKey,
      instructionsText:
        "Seed import: sloučená historie 7 měsíců. Vše je historie k datu " +
        "initial_balance_date, Rezervu nemění.",
      statsJson: JSON.stringify({ parsed: rows.length, errors: errors.length }),
    })
    .returning({ id: importBatches.id });

  const values = rows.map((row) => ({
    accountId,
    fingerprint: row.fingerprint,
    date: row.date,
    amount: row.amount,
    currency: row.currency,
    merchant: row.merchant,
    description: row.description,
    categoryId: row.categoryName
      ? (categoryByName.get(row.categoryName) ?? null)
      : null,
    ownerId: row.ownerName ? (userByName.get(row.ownerName) ?? null) : null,
    isBusiness: false,
    isTransfer: row.isTransfer,
    source: "import" as const,
    status: "confirmed" as const,
    importBatchId: batch.id,
    rawJson: JSON.stringify(row.raw),
  }));

  const [{ value: before }] = await db
    .select({ value: count() })
    .from(transactions)
    .where(eq(transactions.accountId, accountId));

  const statements = [];
  for (let index = 0; index < values.length; index += ROWS_PER_INSERT) {
    statements.push(
      db
        .insert(transactions)
        .values(values.slice(index, index + ROWS_PER_INSERT))
        .onConflictDoNothing({ target: transactions.fingerprint }),
    );
  }

  for (let index = 0; index < statements.length; index += INSERTS_PER_BATCH) {
    const slice = statements.slice(index, index + INSERTS_PER_BATCH);
    await db.batch(slice as [(typeof slice)[number], ...typeof slice]);
  }

  const [{ value: after }] = await db
    .select({ value: count() })
    .from(transactions)
    .where(eq(transactions.accountId, accountId));
  const inserted = after - before;

  const lastDate = rows.reduce<string | null>(
    (latest, row) => (latest === null || row.date > latest ? row.date : latest),
    null,
  );

  // The master CSV ends where the real statements begin. Recording that date
  // is what keeps this history out of Rezerva.
  if (lastDate) {
    await db
      .update(accounts)
      .set({ initialBalanceDate: lastDate })
      .where(eq(accounts.id, accountId));
  }

  await db
    .update(importBatches)
    .set({
      statsJson: JSON.stringify({
        parsed: rows.length,
        inserted,
        errors: errors.length,
      }),
    })
    .where(eq(importBatches.id, batch.id));

  return {
    filename,
    batchId: batch.id,
    parsed: rows.length,
    inserted,
    skippedAsDuplicate: rows.length - inserted,
    errors: errors.map(({ line, reason }) => ({ line, reason })),
    withOwner: rows.filter((row) => row.ownerName).length,
    withCategory: values.filter((row) => row.categoryId !== null).length,
    transfers: rows.filter((row) => row.isTransfer).length,
    lastDate,
    totals: monthlyTotals(rows),
  };
}
