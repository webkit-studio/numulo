import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { categories, rules, transactions } from "@/db/schema";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { decodeStatement } from "@/lib/import/decode";
import { guessColumnMap, validateColumnMap, type ColumnMap } from "@/lib/import/mapping";
import { classifyRows, prepareFile, summarise } from "@/lib/import/pipeline";
import { findProfile } from "@/lib/import/profiles";
import { sniffShape } from "@/lib/import/sniff";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Enough to review; the whole file still gets imported on commit. */
const PREVIEW_ROWS = 400;

/**
 * Reads a statement and says what would happen, without writing anything.
 *
 * Nothing about an import is irreversible-by-accident: the file is decoded,
 * mapped, fingerprinted and classified here, and only a second, explicit call
 * writes rows. That split is what makes the three tabs honest — they show the
 * result of the same code the commit will run.
 */
export const POST = withJsonErrors(async (request: NextRequest) => {
  const form = await request.formData();
  const file = form.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Chybí soubor." }, { status: 400 });
  }

  const decoded = decodeStatement(await file.arrayBuffer());
  const shape = sniffShape(decoded.text);

  if (shape.headers.length === 0) {
    return NextResponse.json(
      {
        error:
          "Nepodařilo se najít hlavičku tabulky. Je to opravdu CSV výpis z banky?",
      },
      { status: 400 },
    );
  }

  // A remembered profile wins over guessing: it was confirmed by a person.
  const profile = await findProfile(shape.headers);
  const overrideJson = form.get("columnMap");
  const override =
    typeof overrideJson === "string" && overrideJson !== ""
      ? (JSON.parse(overrideJson) as ColumnMap)
      : null;

  const columnMap =
    override ?? profile?.columnMap ?? guessColumnMap(shape.headers);
  const problems = validateColumnMap(columnMap);

  if (problems.length > 0) {
    return NextResponse.json({
      needsMapping: true,
      encoding: decoded.encoding,
      shape,
      columnMap,
      problems,
      sample: sampleRows(decoded.text, shape),
      profile: profile ? { id: profile.id, name: profile.name } : null,
    });
  }

  const prepared = await prepareFile(decoded.text, columnMap, shape);

  const db = getDb();
  const [known, categoryRules, transferRules, ownerRules, categoryRows] =
    await Promise.all([
      db
        .select({ fingerprint: transactions.fingerprint })
        .from(transactions)
        .where(eq(transactions.accountId, ACCOUNT_ID)),
      db.select().from(rules).where(eq(rules.accountId, ACCOUNT_ID)),
      db.select().from(rules).where(eq(rules.accountId, ACCOUNT_ID)),
      db.select().from(rules).where(eq(rules.accountId, ACCOUNT_ID)),
      db.select().from(categories).where(eq(categories.accountId, ACCOUNT_ID)),
    ]);

  const categoryById = new Map(categoryRows.map((row) => [row.id, row]));

  const classified = classifyRows({
    rows: prepared.rows,
    known: new Set(known.map((row) => row.fingerprint)),
    categoryRules: new Map(
      categoryRules
        .filter((rule) => rule.kind === "merchant->category")
        .flatMap((rule) => {
          const category = categoryById.get(Number(rule.target));
          return category
            ? ([[rule.pattern.toLowerCase(), { id: category.id, name: category.name }]] as const)
            : [];
        }),
    ),
    transferPatterns: transferRules
      .filter((rule) => rule.kind === "pattern->transfer" && rule.target !== "0")
      .map((rule) => rule.pattern.toLowerCase()),
    ownerRules: new Map(
      ownerRules
        .filter((rule) => rule.kind === "pattern->owner")
        .map((rule) => [rule.pattern.toLowerCase(), Number(rule.target)]),
    ),
  });

  return NextResponse.json({
    needsMapping: false,
    encoding: decoded.encoding,
    encodingAmbiguous: decoded.ambiguous,
    shape,
    columnMap,
    profile: profile ? { id: profile.id, name: profile.name } : null,
    summary: summarise(classified, prepared.errors),
    errors: prepared.errors.slice(0, 50),
    rows: classified.slice(0, PREVIEW_ROWS),
    truncated: classified.length > PREVIEW_ROWS,
  });
});

/** First few data rows, so a person can see what each column actually holds. */
function sampleRows(
  text: string,
  shape: { delimiter: string; skipRows: number; headers: string[] },
): Record<string, string>[] {
  const lines = text
    .split(/\r?\n/)
    .slice(shape.skipRows + 1)
    .filter((line) => line.trim() !== "")
    .slice(0, 3);

  return lines.map((line) => {
    const cells = line.split(shape.delimiter);
    return Object.fromEntries(
      shape.headers.map((header, index) => [
        header,
        (cells[index] ?? "").replace(/^"|"$/g, "").trim(),
      ]),
    );
  });
}
