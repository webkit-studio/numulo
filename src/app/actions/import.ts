"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { decodeStatement } from "@/lib/import/decode";
import { guessColumnMap, validateColumnMap } from "@/lib/import/mapping";
import { classifyRows, prepareFile, summarise, type ClassifiedRow } from "@/lib/import/pipeline";
import { sniffShape } from "@/lib/import/sniff";
import { guessColumnsWithAi } from "@/lib/ai/columns";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * One statement, all the way in.
 *
 * Rows land in the database in the same pass that classifies them, rather than
 * being held in the browser until someone presses a second button. A file that
 * was read is a file that was imported — the only question left is which rows
 * still need a person, and those are marked `review` and answered on the same
 * screen. Nothing to lose by closing the tab.
 *
 * Duplicates are decided by fingerprint, the same value the unique index uses,
 * so the count on the screen and the count in the table cannot disagree.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface ImportResult {
  error: string | null;
  batchId?: string;
  filename?: string;
  added?: number;
  duplicates?: number;
  review?: number;
  /** Set when the model helped with the column mapping. */
  aiNote?: string | null;
  /** What the AI step cost, in tokens. Null when it did not run. */
  tokens?: { input: number; output: number } | null;
}

/** Fingerprints are checked in batches; a year of statements outgrows one IN list. */
async function knownFingerprints(
  supabase: Awaited<ReturnType<typeof createClient>>,
  householdId: string,
  fingerprints: string[],
): Promise<Set<string>> {
  const known = new Set<string>();
  const size = 400;

  for (let start = 0; start < fingerprints.length; start += size) {
    const { data } = await supabase
      .from("transactions")
      .select("fingerprint")
      .eq("household_id", householdId)
      .in("fingerprint", fingerprints.slice(start, start + size));

    for (const row of data ?? []) known.add(String(row.fingerprint));
  }

  return known;
}

export async function runImport(_prev: ImportResult, form: FormData): Promise<ImportResult> {
  const householdId = String(form.get("householdId") ?? "");
  const instructions = String(form.get("instructions") ?? "");
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) return { error: "Vyber soubor s výpisem." };
  if (file.size > 8 * 1024 * 1024) return { error: "Soubor je moc velký (max 8 MB)." };

  const decoded = decodeStatement(await file.arrayBuffer());
  const shape = sniffShape(decoded.text);

  if (shape.headers.length === 0) return { error: "V souboru nejsou žádné sloupce." };

  /* ── sloupce ────────────────────────────────────────────────────────── */

  let map = guessColumnMap(shape.headers);
  let aiNote: string | null = null;
  let tokens: { input: number; output: number } | null = null;

  // The model refines the guess; it never replaces the check that follows.
  try {
    const guess = await guessColumnsWithAi(shape.headers, map, instructions);
    if (guess) {
      map = guess.map;
      aiNote = guess.note;
      tokens = guess.tokens;
    }
  } catch (error) {
    // A model that is down is not a reason not to import a file.
    console.warn("[import] AI mapping skipped:", error);
  }

  const problems = validateColumnMap(map);
  if (problems.length > 0) {
    return {
      error: `Nepoznávám sloupce: ${problems.map((problem) => problem.message).join(", ")}.`,
    };
  }

  const prepared = await prepareFile(decoded.text, map, shape);
  if (prepared.rows.length === 0) {
    return { error: "V souboru nejsou žádné čitelné řádky." };
  }

  /* ── pravidla a duplicity ───────────────────────────────────────────── */

  const supabase = await createClient();

  const [{ data: ruleRows }, { data: categoryRows }, known] = await Promise.all([
    supabase.from("rules").select("kind, pattern, target").eq("household_id", householdId),
    supabase.from("categories").select("id, name").eq("household_id", householdId),
    knownFingerprints(supabase, householdId, prepared.rows.map((row) => row.fingerprint)),
  ]);

  const categoriesById = new Map((categoryRows ?? []).map((row) => [String(row.id), String(row.name)]));

  const categoryRules = new Map<string, { id: string; name: string }>();
  const ownerRules = new Map<string, string>();
  const transferPatterns: string[] = [];

  for (const rule of ruleRows ?? []) {
    const pattern = String(rule.pattern);
    if (rule.kind === "merchant->category" && categoriesById.has(String(rule.target))) {
      categoryRules.set(pattern, {
        id: String(rule.target),
        name: categoriesById.get(String(rule.target)) ?? "",
      });
    } else if (rule.kind === "pattern->owner") {
      ownerRules.set(pattern, String(rule.target));
    } else if (rule.kind === "pattern->transfer") {
      transferPatterns.push(pattern);
    }
  }

  const classified = classifyRows({
    rows: prepared.rows,
    known,
    categoryRules,
    transferPatterns,
    ownerRules,
  });

  const summary = summarise(classified, prepared.errors);

  /* ── zápis ──────────────────────────────────────────────────────────── */

  const { data: batch, error: batchError } = await supabase
    .from("import_batches")
    .insert({
      household_id: householdId,
      filename: file.name,
      instructions_text: instructions || null,
      stats_json: {
        total: summary.total,
        // What actually landed in the table — rows a rule could name plus
        // rows waiting for a person. "added: ready" reported nothing on a
        // first import, when no rule exists yet and every row needs a look.
        added: summary.ready + summary.review,
        ready: summary.ready,
        duplicates: summary.duplicates,
        review: summary.review,
        errors: summary.errors,
        months: summary.months,
        ai: tokens,
        // Kept so the "duplicitní" tab can show what each skipped row collided
        // with. Capped: a re-import of a whole year would otherwise store a
        // few thousand hashes nobody will ever open.
        duplicateFingerprints: classified
          .filter((row) => row.verdict === "duplicate")
          .slice(0, 200)
          .map((row) => row.fingerprint),
      },
    })
    .select("id")
    .single();

  if (batchError) return { error: batchError.message };

  const insertable = classified.filter((row) => row.verdict !== "duplicate");
  const payload = insertable.map((row: ClassifiedRow) => ({
    household_id: householdId,
    fingerprint: row.fingerprint,
    date: row.date,
    amount: row.amount,
    currency: row.currency || "CZK",
    merchant: row.merchant || null,
    description: row.description || null,
    category_id: row.categoryId,
    owner_id: row.ownerId,
    is_transfer: row.isTransfer,
    is_business: false,
    source: "import",
    // A row a rule could not name is a row a person should see.
    status: row.verdict === "review" ? "review" : "confirmed",
    import_batch_id: batch.id,
  }));

  for (let start = 0; start < payload.length; start += 500) {
    const { error } = await supabase
      .from("transactions")
      .upsert(payload.slice(start, start + 500), {
        onConflict: "household_id,fingerprint",
        ignoreDuplicates: true,
      });
    if (error) return { error: error.message };
  }

  revalidatePath("/", "layout");

  return {
    error: null,
    batchId: String(batch.id),
    filename: file.name,
    added: summary.ready,
    duplicates: summary.duplicates,
    review: summary.review,
    aiNote,
    tokens,
  };
}

/** "Zahodit" on a row awaiting approval — it was never a household payment. */
export async function discardRow(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").delete().eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}

/** "Přidat" — the row is fine as it stands, it just needed a person to say so. */
export async function confirmRow(id: string): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { error } = await supabase.from("transactions").update({ status: "confirmed" }).eq("id", id);
  if (error) return { error: error.message };

  revalidatePath("/", "layout");
  return { error: null };
}
