"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { callWorker, AI_OFF } from "@/lib/ai/worker";
import { fingerprintAll } from "@/lib/import/fingerprint";
import { czkToHalere } from "@/lib/money";
import { commitPreparedRows } from "./import";
import { matchDebtPayments } from "./debts";
import type { PreparedRow } from "@/lib/import/pipeline";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * The AI jobs: a PDF statement in, categories onto merchants.
 *
 * Both run in the ai-worker Edge Function because they outlive a Netlify
 * function. The shape is always the same three steps:
 *
 *   1. start*  — create an ai_jobs row and poke the worker (answers 202),
 *   2. getAiJob — the UI polls the row,
 *   3. apply*  — the app takes the job's JSON result and writes tables itself.
 *
 * Step 3 is the deliberate one: the model transcribes and suggests, this code
 * decides. A PDF row becomes a transaction through the very same fingerprint
 * and rules as a CSV row; a category suggestion becomes a rule that future
 * imports apply without any model at all.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface AiStart {
  error: string | null;
  jobId?: string;
}

export interface AiJobView {
  id: string;
  kind: string;
  status: "queued" | "running" | "done" | "error";
  error: string | null;
  tokens: { input: number; output: number };
}

export async function getAiJob(jobId: string): Promise<AiJobView | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("ai_jobs")
    .select("id, kind, status, error, input_tokens, output_tokens")
    .eq("id", jobId)
    .maybeSingle();

  if (!data) return null;
  return {
    id: String(data.id),
    kind: String(data.kind),
    status: data.status as AiJobView["status"],
    error: (data.error as string) ?? null,
    tokens: { input: Number(data.input_tokens ?? 0), output: Number(data.output_tokens ?? 0) },
  };
}

/* ── PDF výpis ─────────────────────────────────────────────────────────── */

export async function startPdfExtract(form: FormData): Promise<AiStart> {
  const householdId = String(form.get("householdId") ?? "");
  const instructions = String(form.get("instructions") ?? "");
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) return { error: "Vyber PDF s výpisem." };
  if (file.size > 8 * 1024 * 1024) return { error: "Soubor je moc velký (max 8 MB)." };

  const supabase = await createClient();

  // Upload FIRST, then insert the job with its payload complete. The order
  // matters because ai_jobs deliberately has no update policy for users —
  // only the worker's service role may touch a job after it exists. An
  // earlier version inserted an empty payload and "filled it in" with an
  // update, which RLS silently turned into updating zero rows.
  const path = `${householdId}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("statements")
    .upload(path, file, { contentType: "application/pdf" });
  if (uploadError) return { error: uploadError.message };

  const { data: job, error: jobError } = await supabase
    .from("ai_jobs")
    .insert({
      household_id: householdId,
      kind: "pdf-extract",
      payload: { storage_path: path, instructions, filename: file.name },
    })
    .select("id")
    .single();
  if (jobError) return { error: jobError.message };

  const { status, body } = await callWorker({ task: "pdf-extract", jobId: job.id });
  if (status === 501) return { error: AI_OFF };
  if (status !== 202) return { error: String(body.error ?? `worker ${status}`) };

  return { error: null, jobId: String(job.id) };
}

interface ExtractedRow {
  date: string;
  amount_czk: number;
  currency: string;
  merchant: string;
  description: string;
  vs: string | null;
  counter_account: string | null;
}

/** Turns the finished extraction into transactions — the CSV door, reused. */
export async function commitPdfImport(jobId: string): Promise<{
  error: string | null;
  added?: number;
  duplicates?: number;
  review?: number;
  filename?: string;
}> {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("ai_jobs")
    .select("id, household_id, status, payload, result, input_tokens, output_tokens")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return { error: "Úloha se nenašla." };
  if (job.status !== "done") return { error: `Úloha není hotová (${job.status}).` };

  const raw = ((job.result as { rows?: ExtractedRow[] })?.rows ?? []).filter(
    (row) =>
      /^\d{4}-\d{2}-\d{2}$/.test(row.date ?? "") &&
      Number.isFinite(row.amount_czk) &&
      row.amount_czk !== 0,
  );
  if (raw.length === 0) return { error: "Model ve výpisu nenašel žádné čitelné transakce." };

  const mapped = raw.map((row, index) => ({
    date: row.date,
    amount: czkToHalere(row.amount_czk),
    currency: row.currency || "CZK",
    description: (row.description || row.merchant || "").slice(0, 300),
    counterparty: (row.merchant || "").slice(0, 200),
    counterAccount: row.counter_account ?? "",
    vs: row.vs ?? "",
    card: "",
    line: index + 1,
  }));

  const fingerprints = await fingerprintAll(
    mapped.map((row) => ({
      date: row.date,
      amount: row.amount,
      currency: row.currency,
      counterAccount: row.counterAccount,
      vs: row.vs,
      normalizedDescription: row.description.toLowerCase().replace(/\s+/g, " ").trim(),
      // One statement is one account — the same convention the CSV path uses,
      // so a CSV re-import of the same period dedups against the PDF rows.
      ownAccount: "",
    })),
  );
  const rows: PreparedRow[] = mapped.map((row, index) => ({
    ...row,
    fingerprint: fingerprints[index],
    merchant: (row.counterparty || row.description).split(",")[0].trim().slice(0, 120),
  }));

  const payload = job.payload as { filename?: string; instructions?: string } | null;
  const commit = await commitPreparedRows({
    householdId: String(job.household_id),
    filename: payload?.filename ?? "výpis.pdf",
    instructions: payload?.instructions ?? "",
    rows,
    errors: [],
    aiTokens: { input: Number(job.input_tokens ?? 0), output: Number(job.output_tokens ?? 0) },
  });
  if (commit.error !== null) return { error: commit.error };

  // The statement is in the tables; the uploaded file has done its job.
  const storagePath = (job.payload as { storage_path?: string })?.storage_path;
  if (storagePath) await supabase.storage.from("statements").remove([storagePath]);

  try {
    await matchDebtPayments();
  } catch {
    /* matching is a convenience, never a reason to fail an import */
  }

  revalidatePath("/", "layout");
  return {
    error: null,
    filename: payload?.filename,
    added: commit.summary.ready + commit.summary.review,
    duplicates: commit.summary.duplicates,
    review: commit.summary.review,
  };
}

/* ── kategorie ─────────────────────────────────────────────────────────── */

export async function startCategorize(householdId: string): Promise<AiStart> {
  const supabase = await createClient();

  const [{ data: uncategorized }, { data: categoryRows }] = await Promise.all([
    supabase
      .from("transactions")
      .select("merchant, description")
      .eq("household_id", householdId)
      .is("category_id", null)
      .lt("amount", 0)
      .limit(3000),
    supabase
      .from("categories")
      .select("name, parent_id")
      .eq("household_id", householdId),
  ]);

  // Distinct merchant names, most frequent first — the model sees names,
  // never amounts, never accounts.
  const counts = new Map<string, number>();
  for (const row of uncategorized ?? []) {
    const name = ((row.merchant as string) || (row.description as string) || "").trim();
    if (name.length < 2) continue;
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const merchants = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 400)
    .map(([name]) => name);

  if (merchants.length === 0) {
    return { error: "Není co třídit — všechno už kategorii má." };
  }

  const parents = (categoryRows ?? [])
    .filter((row) => !row.parent_id)
    .map((row) => String(row.name));

  const { data: job, error: jobError } = await supabase
    .from("ai_jobs")
    .insert({
      household_id: householdId,
      kind: "categorize",
      payload: { merchants, categories: parents },
    })
    .select("id")
    .single();
  if (jobError) return { error: jobError.message };

  const { status, body } = await callWorker({ task: "categorize", jobId: job.id });
  if (status === 501) return { error: AI_OFF };
  if (status !== 202) return { error: String(body.error ?? `worker ${status}`) };

  return { error: null, jobId: String(job.id) };
}

interface Assignment {
  merchant: string;
  category: string;
  subcategory: string | null;
}

/**
 * Suggestions become rules, rules become categories on rows.
 *
 * Order matters: a subcategory only ever hangs under a parent that already
 * exists in the household's own set, and an invented parent name is dropped
 * on the floor. What survives is written as merchant→category rules — which
 * is why the NEXT statement sorts itself without any model at all.
 */
export async function applyCategorize(jobId: string): Promise<{
  error: string | null;
  categorized?: number;
  newSubcategories?: number;
}> {
  const supabase = await createClient();
  const { data: job } = await supabase
    .from("ai_jobs")
    .select("id, household_id, status, result")
    .eq("id", jobId)
    .maybeSingle();

  if (!job) return { error: "Úloha se nenašla." };
  if (job.status !== "done") return { error: `Úloha není hotová (${job.status}).` };

  const householdId = String(job.household_id);
  const assignments = ((job.result as { assignments?: Assignment[] })?.assignments ?? []).filter(
    (item) => item.merchant && item.category,
  );
  if (assignments.length === 0) return { error: "Model nevrátil žádné návrhy." };

  const { data: categoryRows } = await supabase
    .from("categories")
    .select("id, name, parent_id, sort")
    .eq("household_id", householdId);

  const byName = new Map(
    (categoryRows ?? []).map((row) => [String(row.name).toLowerCase(), row]),
  );
  const maxSort = Math.max(0, ...(categoryRows ?? []).map((row) => Number(row.sort)));

  let newSubcategories = 0;
  let categorized = 0;

  for (const item of assignments) {
    const parent = byName.get(item.category.trim().toLowerCase());
    if (!parent || parent.parent_id) continue; // invented or nested parent → out

    let targetId = String(parent.id);

    const subName = item.subcategory?.trim();
    if (subName && subName.length >= 3 && subName.toLowerCase() !== item.category.trim().toLowerCase()) {
      const existing = byName.get(subName.toLowerCase());
      if (existing && String(existing.parent_id) === String(parent.id)) {
        targetId = String(existing.id);
      } else if (!existing) {
        const { data: created } = await supabase
          .from("categories")
          .insert({
            household_id: householdId,
            name: subName,
            color: "#9DB3A5",
            sort: maxSort + 10 + newSubcategories,
            in_envelopes: false,
            parent_id: parent.id,
          })
          .select("id, name, parent_id, sort")
          .single();
        if (created) {
          byName.set(subName.toLowerCase(), created);
          targetId = String(created.id);
          newSubcategories += 1;
        }
      }
      // A name that exists under a DIFFERENT parent keeps the parent target —
      // second-guessing the household's own tree is not the model's call.
    }

    await supabase.from("rules").upsert(
      {
        household_id: householdId,
        kind: "merchant->category",
        pattern: item.merchant,
        target: targetId,
        created_from: "ai-kategorizace",
      },
      { onConflict: "household_id,kind,pattern" },
    );

    // Only rows nobody has decided yet — a rule never overwrites a person.
    const { data: touched } = await supabase
      .from("transactions")
      .update({ category_id: targetId })
      .eq("household_id", householdId)
      .is("category_id", null)
      .ilike("merchant", `%${item.merchant}%`)
      .select("id");

    categorized += touched?.length ?? 0;
  }

  revalidatePath("/", "layout");
  return { error: null, categorized, newSubcategories };
}
