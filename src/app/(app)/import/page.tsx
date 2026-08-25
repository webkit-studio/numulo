import Link from "next/link";
import type { Metadata } from "next";
import { Money } from "@/components/money";
import { Upload } from "./upload";
import { ReviewRows, type ReviewRow } from "./review-rows";
import { EditableTransactions } from "../transakce/editable-transactions";
import { createClient } from "@/lib/supabase/server";
import { getMembers, getSession } from "@/lib/data/household";
import { todayIso } from "@/lib/data/months";
import { shortDate } from "@/lib/date";
import type { TransactionRow } from "@/lib/data/month";

export const metadata: Metadata = { title: "Numulo — import" };
export const dynamic = "force-dynamic";

type Tab = "pridano" | "duplicitni" | "schvaleni";

const TABS: { key: Tab; label: string }[] = [
  { key: "pridano", label: "Přidáno" },
  { key: "duplicitni", label: "Duplicitní" },
  { key: "schvaleni", label: "Ke schválení" },
];

interface BatchStats {
  /** Rows that landed in the table, whether or not they still need a look. */
  added?: number;
  ready?: number;
  duplicates?: number;
  review?: number;
  duplicateFingerprints?: string[];
}

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { household } = await getSession();
  if (!household) return null;

  const supabase = await createClient();
  const today = todayIso();

  const [{ data: batches }, members] = await Promise.all([
    supabase
      .from("import_batches")
      .select("id, filename, imported_at, stats_json")
      .eq("household_id", household.id)
      .order("imported_at", { ascending: false })
      .limit(6),
    getMembers(household.id),
  ]);

  const latest = batches?.[0] ?? null;
  const stats = (latest?.stats_json ?? {}) as BatchStats;

  const tabParam = typeof params.tab === "string" ? params.tab : "";
  const tab: Tab = TABS.some((entry) => entry.key === tabParam) ? (tabParam as Tab) : "pridano";

  /* ── řádky posledního importu ───────────────────────────────────────── */

  let added: TransactionRow[] = [];
  let review: ReviewRow[] = [];
  let duplicates: TransactionRow[] = [];
  let categories: { id: string; name: string; color: string }[] = [];

  if (latest) {
    const fingerprints = (stats.duplicateFingerprints ?? []).slice(0, 200);

    const [{ data: rows }, { data: categoryRows }, { data: duplicateRows }] = await Promise.all([
      supabase
        .from("transactions")
        .select("*, categories(name, color)")
        .eq("import_batch_id", latest.id)
        .order("date", { ascending: false }),
      supabase.from("categories").select("id, name, color").eq("household_id", household.id).order("sort"),
      fingerprints.length > 0
        ? supabase
            .from("transactions")
            .select("*, categories(name, color)")
            .eq("household_id", household.id)
            .in("fingerprint", fingerprints)
            .order("date", { ascending: false })
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
    ]);

    const shape = (row: Record<string, unknown>): TransactionRow => {
      const category = row.categories as { name: string; color: string } | null;
      return {
        id: String(row.id),
        date: String(row.date),
        amount: Number(row.amount),
        merchant: (row.merchant as string) ?? null,
        description: (row.description as string) ?? null,
        categoryId: (row.category_id as string) ?? null,
        categoryName: category?.name ?? null,
        categoryColor: category?.color ?? null,
        ownerId: (row.owner_id as string) ?? null,
        isBusiness: Boolean(row.is_business),
        isTransfer: Boolean(row.is_transfer),
        status: row.status as "confirmed" | "review",
      };
    };

    added = (rows ?? []).filter((row) => row.status === "confirmed").map(shape);
    review = (rows ?? [])
      .filter((row) => row.status === "review")
      .map((row) => ({
        id: String(row.id),
        date: String(row.date),
        merchant: String(row.merchant ?? row.description ?? "—"),
        amount: Number(row.amount),
      }));
    duplicates = (duplicateRows ?? []).map(shape);
    categories = (categoryRows ?? []).map((row) => ({
      id: String(row.id),
      name: String(row.name),
      color: String(row.color),
    }));
  }

  const counts: Record<Tab, number> = {
    pridano: added.length,
    duplicitni: duplicates.length || (stats.duplicates ?? 0),
    schvaleni: review.length,
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Import</h1>
          <p className="page-sub">dostaň výpis dovnitř</p>
        </div>
      </header>

      <div className="row">
        <section className="card grow-2">
          <div className="card-head"><h2 className="card-title">Nový výpis</h2></div>
          <Upload householdId={household.id} />
        </section>

        <section className="card grow-1">
          <div className="card-head"><h2 className="card-title">Poslední importy</h2></div>
          {batches && batches.length > 0 ? (
            <ul className="imports">
              {batches.map((batch) => {
                const batchStats = (batch.stats_json ?? {}) as BatchStats;
                return (
                  <li key={batch.id}>
                    <span className="imports-name">{batch.filename}</span>
                    <span className="imports-meta">
                      {shortDate(String(batch.imported_at).slice(0, 10))} ·{" "}
                      {batchStats.added ?? 0} plateb
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="empty">Zatím žádný import.</p>
          )}
        </section>
      </div>

      {latest ? (
        <section className="card tabbed">
          <div className="tabs" role="tablist">
            {TABS.map((entry) => (
              <Link
                key={entry.key}
                href={`/import?tab=${entry.key}`}
                role="tab"
                aria-selected={tab === entry.key}
                className={`tab${tab === entry.key ? " is-on" : ""}${entry.key === "schvaleni" ? " tab-amber" : ""}`}
              >
                <span className="tab-label">{entry.label}</span>
                <span className="tab-count num">{counts[entry.key]}</span>
                {tab === entry.key ? null : <span className="tab-more">procházet ›</span>}
              </Link>
            ))}
          </div>

          <div className={`tab-panel tab-panel-${tab}`} role="tabpanel">
            {tab === "pridano" ? (
              added.length > 0 ? (
                <EditableTransactions
                  transactions={added}
                  categories={categories}
                  members={members}
                  today={today}
                />
              ) : (
                <p className="empty">Z tohohle výpisu nepřibylo nic nového.</p>
              )
            ) : null}

            {tab === "duplicitni" ? (
              duplicates.length > 0 ? (
                <>
                  <p className="quiet-note">
                    Tyhle řádky už v Numulu byly — necháváme je, jak jsou.
                  </p>
                  <ul className="duplicates">
                    {duplicates.map((row) => (
                      <li key={row.id}>
                        <span className="duplicates-name">
                          {row.merchant || row.description || "—"}
                          {row.categoryName ? (
                            <span className="badge badge-quiet">{row.categoryName}</span>
                          ) : null}
                        </span>
                        <span className="duplicates-meta">
                          už v Numulu: {shortDate(row.date)}
                        </span>
                        <span className="duplicates-amount"><Money value={row.amount} /></span>
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p className="empty">Žádné duplicity. 🌱</p>
              )
            ) : null}

            {tab === "schvaleni" ? <ReviewRows rows={review} /> : null}
          </div>
        </section>
      ) : null}
    </>
  );
}
