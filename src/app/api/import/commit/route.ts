import { getCloudflareContext } from "@opennextjs/cloudflare";
import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { categories, importBatches, rules, transactions } from "@/db/schema";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { decodeStatement } from "@/lib/import/decode";
import { guessColumnMap, validateColumnMap, type ColumnMap } from "@/lib/import/mapping";
import { classifyRows, prepareFile, summarise } from "@/lib/import/pipeline";
import { findProfile, saveProfile } from "@/lib/import/profiles";
import { sniffShape } from "@/lib/import/sniff";
import { withJsonErrors } from "@/lib/http";
import { applyAllRules } from "@/lib/rules/engine";

export const dynamic = "force-dynamic";

/** D1 allows 100 bound parameters per query; 12 columns × 8 rows stays under. */
const ROWS_PER_INSERT = 8;
const INSERTS_PER_BATCH = 20;

/**
 * Writes an import.
 *
 * Re-runs the whole preview pipeline instead of trusting rows posted from the
 * browser: the client could send anything, and a fingerprint decided on the
 * client would let a duplicate through. The file is the input, always.
 */
export const POST = withJsonErrors(async (request: NextRequest) => {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor." }, { status: 400 });
  }

  const bytes = await file.arrayBuffer();
  const decoded = decodeStatement(bytes);
  const shape = sniffShape(decoded.text);

  const overrideJson = form.get("columnMap");
  const profile = await findProfile(shape.headers);
  const columnMap: ColumnMap =
    typeof overrideJson === "string" && overrideJson !== ""
      ? (JSON.parse(overrideJson) as ColumnMap)
      : (profile?.columnMap ?? guessColumnMap(shape.headers));

  const problems = validateColumnMap(columnMap);
  if (problems.length > 0) {
    return NextResponse.json(
      { error: problems.map((problem) => problem.message).join(" ") },
      { status: 400 },
    );
  }

  // "Ke schválení" rows come in only when the household ticked them; without
  // that, an import silently adds transactions nobody looked at.
  const includeReview = form.get("includeReview") === "true";
  const instructions = form.get("instructions");
  const profileName = form.get("profileName");

  const prepared = await prepareFile(decoded.text, columnMap, shape);
  const db = getDb();

  const [known, storedRules, categoryRows] = await Promise.all([
    db
      .select({ fingerprint: transactions.fingerprint })
      .from(transactions)
      .where(eq(transactions.accountId, ACCOUNT_ID)),
    db.select().from(rules).where(eq(rules.accountId, ACCOUNT_ID)),
    db.select().from(categories).where(eq(categories.accountId, ACCOUNT_ID)),
  ]);

  const categoryById = new Map(categoryRows.map((row) => [row.id, row]));

  const classified = classifyRows({
    rows: prepared.rows,
    known: new Set(known.map((row) => row.fingerprint)),
    categoryRules: new Map(
      storedRules
        .filter((rule) => rule.kind === "merchant->category")
        .flatMap((rule) => {
          const category = categoryById.get(Number(rule.target));
          return category
            ? ([[rule.pattern.toLowerCase(), { id: category.id, name: category.name }]] as const)
            : [];
        }),
    ),
    transferPatterns: storedRules
      .filter((rule) => rule.kind === "pattern->transfer" && rule.target !== "0")
      .map((rule) => rule.pattern.toLowerCase()),
    ownerRules: new Map(
      storedRules
        .filter((rule) => rule.kind === "pattern->owner")
        .map((rule) => [rule.pattern.toLowerCase(), Number(rule.target)]),
    ),
  });

  const toInsert = classified.filter(
    (row) =>
      row.verdict === "new" || (includeReview && row.verdict === "review"),
  );

  const storageKey = await archive(file.name, bytes);

  const [batch] = await db
    .insert(importBatches)
    .values({
      accountId: ACCOUNT_ID,
      filename: file.name,
      storageKey,
      instructionsText: typeof instructions === "string" ? instructions : null,
      formatProfileId: profile?.id ?? null,
      statsJson: JSON.stringify(summarise(classified, prepared.errors)),
    })
    .returning({ id: importBatches.id });

  const before = await countRows(db);

  for (let i = 0; i < toInsert.length; i += ROWS_PER_INSERT * INSERTS_PER_BATCH) {
    const window = toInsert.slice(i, i + ROWS_PER_INSERT * INSERTS_PER_BATCH);
    const statements = [];

    for (let j = 0; j < window.length; j += ROWS_PER_INSERT) {
      const chunk = window.slice(j, j + ROWS_PER_INSERT);
      statements.push(
        db
          .insert(transactions)
          .values(
            chunk.map((row) => ({
              accountId: ACCOUNT_ID,
              fingerprint: row.fingerprint,
              date: row.date,
              amount: row.amount,
              currency: row.currency,
              merchant: row.merchant || null,
              description: row.description || null,
              categoryId: row.categoryId,
              ownerId: row.ownerId,
              isTransfer: row.isTransfer,
              importBatchId: batch.id,
              status: row.verdict === "review" ? ("review" as const) : ("confirmed" as const),
            })),
          )
          // The unique index on fingerprint is the real duplicate guard; the
          // preview's verdict is only what the screen showed.
          .onConflictDoNothing(),
      );
    }

    if (statements.length > 0) await db.batch(statements as never);
  }

  const after = await countRows(db);

  // New rows arrive after the rules were read, so replay them once at the end.
  const applied = await applyAllRules(db, ACCOUNT_ID);

  if (typeof profileName === "string" && profileName.trim() !== "") {
    await saveProfile({
      name: profileName.trim(),
      headers: shape.headers,
      delimiter: shape.delimiter,
      encoding: decoded.encoding,
      skipRows: shape.skipRows,
      columnMap,
    });
  }

  return NextResponse.json({
    ok: true,
    batchId: batch.id,
    // Counted from the table, not from what was sent: ON CONFLICT means the
    // two numbers can legitimately differ, and the table is the truth.
    added: after - before,
    attempted: toInsert.length,
    skippedDuplicates: classified.filter((row) => row.verdict === "duplicate").length,
    leftForReview: includeReview
      ? 0
      : classified.filter((row) => row.verdict === "review").length,
    ruleUpdates: applied.updated,
    archived: storageKey !== null,
    summary: summarise(classified, prepared.errors),
  });
});

async function countRows(db: ReturnType<typeof getDb>): Promise<number> {
  return Number(
    await db.$count(transactions, eq(transactions.accountId, ACCOUNT_ID)),
  );
}

/**
 * Keeps the original file in Object Storage.
 *
 * Every derived number in numo can be recomputed from these files, so losing
 * one means losing the ability to prove where a total came from. Archiving
 * failing must not fail the import, though — the transactions are the point.
 */
async function archive(filename: string, bytes: ArrayBuffer): Promise<string | null> {
  try {
    const { env } = getCloudflareContext();
    const bucket = (env as { IMPORTS?: R2Bucket }).IMPORTS;
    if (!bucket) return null;

    const safe = filename.replace(/[^\w.\-]+/g, "_").slice(0, 80);
    const key = `imports/${new Date().toISOString().replace(/[:.]/g, "-")}-${safe}`;
    await bucket.put(key, bytes);
    return key;
  } catch (error) {
    console.error("[numo] archivace souboru selhala:", error);
    return null;
  }
}
