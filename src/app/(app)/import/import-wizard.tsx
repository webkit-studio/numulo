"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";
import { formatCzk } from "@/lib/money";

interface ColumnMap {
  date: string | null;
  amount: string | null;
  debit: string | null;
  credit: string | null;
  currency: string | null;
  description: string | null;
  counterparty: string | null;
  counterAccount: string | null;
  vs: string | null;
  card: string | null;
}

interface PreviewRow {
  line: number;
  date: string;
  amount: number;
  merchant: string;
  description: string;
  verdict: "duplicate" | "review" | "new";
  categoryName: string | null;
  note: string | null;
}

interface Preview {
  needsMapping: boolean;
  encoding: string;
  encodingAmbiguous?: boolean;
  shape: { delimiter: string; skipRows: number; headers: string[] };
  columnMap: ColumnMap;
  profile: { id: number; name: string } | null;
  problems?: { field: string; message: string }[];
  sample?: Record<string, string>[];
  summary?: {
    total: number;
    duplicates: number;
    review: number;
    ready: number;
    errors: number;
    months: { month: string; rows: number; income: number; expenses: number }[];
  };
  errors?: { line: number; reason: string }[];
  rows?: PreviewRow[];
  truncated?: boolean;
}

const FIELD_LABELS: [keyof ColumnMap, string][] = [
  ["date", "Datum"],
  ["amount", "Částka (se znaménkem)"],
  ["debit", "Výdaj (bez znaménka)"],
  ["credit", "Příjem (bez znaménka)"],
  ["currency", "Měna"],
  ["description", "Popis"],
  ["counterparty", "Obchodník / protistrana"],
  ["counterAccount", "Protiúčet"],
  ["vs", "Variabilní symbol"],
  ["card", "Karta"],
];

const TABS = [
  { key: "new" as const, label: "Přidáno" },
  { key: "review" as const, label: "Ke schválení" },
  { key: "duplicate" as const, label: "Duplicitní" },
];

/**
 * Import in two steps: look, then commit.
 *
 * Nothing is written until the second button. The tabs show the output of the
 * same code the commit runs, so what is promised and what happens cannot drift
 * apart — the alternative is a preview that lies once and is never trusted
 * again.
 */
export function ImportWizard({ aiAvailable }: { aiAvailable: boolean }) {
  const router = useRouter();
  const toast = useToast();

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [columnMap, setColumnMap] = useState<ColumnMap | null>(null);
  const [tab, setTab] = useState<"new" | "review" | "duplicate">("new");
  const [includeReview, setIncludeReview] = useState(true);
  const [instructions, setInstructions] = useState("");
  const [profileName, setProfileName] = useState("");
  const [busy, setBusy] = useState<null | "preview" | "commit" | "ai">(null);
  const [done, setDone] = useState<string | null>(null);

  async function send(path: string, extra: Record<string, string> = {}) {
    if (!file) return null;
    const body = new FormData();
    body.set("file", file);
    for (const [key, value] of Object.entries(extra)) body.set(key, value);

    const response = await fetch(apiUrl(path), { method: "POST", body });
    const text = await response.text();

    let data: unknown = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      toast.show(
        `Server vrátil HTTP ${response.status} a odpověď, která není JSON.`,
        { tone: "danger" },
      );
      return null;
    }

    if (!response.ok) {
      toast.show(
        (data as { error?: string })?.error ?? `Server vrátil HTTP ${response.status}.`,
        { tone: "danger" },
      );
      return null;
    }
    return data;
  }

  async function runPreview(map: ColumnMap | null = columnMap) {
    setBusy("preview");
    setDone(null);
    const data = (await send(
      "/api/import/preview",
      map ? { columnMap: JSON.stringify(map) } : {},
    )) as Preview | null;
    setBusy(null);

    if (!data) return;
    setPreview(data);
    setColumnMap(data.columnMap);
    setTab(data.summary && data.summary.ready === 0 && data.summary.review > 0 ? "review" : "new");

    if (data.needsMapping) {
      toast.show("Sloupce se nepodařilo rozpoznat — přiřaď je ručně.", {
        tone: "info",
      });
    }
  }

  async function askAiForMapping() {
    if (!preview) return;
    setBusy("ai");
    try {
      const response = await fetch(apiUrl("/api/ai/map-columns"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headers: preview.shape.headers,
          sample: preview.sample ?? [],
        }),
      });
      const data = (await response.json()) as {
        columnMap?: ColumnMap;
        error?: string;
      };
      if (!response.ok) {
        toast.show(data.error ?? "Nepovedlo se.", { tone: "danger" });
        return;
      }
      setColumnMap(data.columnMap ?? null);
      toast.show("Návrh mapování je dole — projdi ho a potvrď.", { tone: "info" });
    } catch {
      toast.show("Server neodpověděl.", { tone: "danger" });
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    setBusy("commit");
    const data = (await send("/api/import/commit", {
      ...(columnMap ? { columnMap: JSON.stringify(columnMap) } : {}),
      includeReview: String(includeReview),
      instructions,
      profileName,
    })) as {
      added: number;
      skippedDuplicates: number;
      leftForReview: number;
      ruleUpdates: number;
      archived: boolean;
    } | null;
    setBusy(null);

    if (!data) return;

    setDone(
      `Přidáno ${data.added} transakcí · ${data.skippedDuplicates} duplicit přeskočeno` +
        (data.leftForReview > 0 ? ` · ${data.leftForReview} zůstalo ke schválení` : "") +
        (data.ruleUpdates > 0 ? ` · pravidla srovnala ${data.ruleUpdates} řádků` : "") +
        (data.archived ? " · soubor uložen do archivu" : " · archiv není nastavený"),
    );
    setPreview(null);
    toast.show(`Import hotový: ${data.added} nových transakcí.`, {
      tone: "success",
    });
    router.refresh();
  }

  const rows = preview?.rows ?? [];
  const shown = rows.filter((row) => row.verdict === tab);

  return (
    <div className="import">
      <div className="crud-fields">
        <label className="crud-field">
          <span className="crud-label">Soubor s výpisem (CSV)</span>
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={(event) => {
              setFile(event.target.files?.[0] ?? null);
              setPreview(null);
              setColumnMap(null);
              setDone(null);
            }}
          />
        </label>

        <label className="crud-field">
          <span className="crud-label">Pokyny k souboru (nepovinné)</span>
          <textarea
            rows={2}
            placeholder="Karta 4141 je Věrky. Všechno z Alzy je podnikání."
            value={instructions}
            onChange={(event) => setInstructions(event.target.value)}
          />
          <span className="crud-hint">
            Uloží se k importu jako poznámka.
            {aiAvailable
              ? " Pravidla se z nich dají navrhnout níž na téhle stránce."
              : ""}
          </span>
        </label>
      </div>

      <div className="crud-form-actions">
        <button
          type="button"
          className="is-primary"
          disabled={!file || busy !== null}
          onClick={() => void runPreview()}
        >
          {busy === "preview" ? "Čtu soubor…" : "Načíst a ukázat, co se stane"}
        </button>
      </div>

      {done ? <p className="import-done">{done}</p> : null}

      {preview ? (
        <>
          <p className="seed-hint">
            Kódování: {preview.encoding}
            {preview.encodingAmbiguous
              ? " — v textu zůstaly poškozené znaky, zkontroluj diakritiku"
              : ""}
            {" · "}oddělovač „{preview.shape.delimiter}"
            {preview.shape.skipRows > 0
              ? ` · přeskočeno ${preview.shape.skipRows} řádků nad hlavičkou`
              : ""}
            {preview.profile ? ` · známý formát „${preview.profile.name}"` : ""}
          </p>

          {preview.needsMapping || columnMap ? (
            <details className="import-mapping" open={preview.needsMapping}>
              <summary>Přiřazení sloupců</summary>

              {preview.problems?.map((problem) => (
                <p key={problem.field} className="import-problem">
                  {problem.message}
                </p>
              ))}

              <div className="crud-fields">
                {FIELD_LABELS.map(([field, label]) => (
                  <label key={field} className="crud-field is-half">
                    <span className="crud-label">{label}</span>
                    <select
                      value={columnMap?.[field] ?? ""}
                      onChange={(event) =>
                        setColumnMap((current) =>
                          current
                            ? {
                                ...current,
                                [field]: event.target.value === "" ? null : event.target.value,
                              }
                            : current,
                        )
                      }
                    >
                      <option value="">— není —</option>
                      {preview.shape.headers.map((header) => (
                        <option key={header} value={header}>
                          {header}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </div>

              <div className="crud-form-actions">
                <button
                  type="button"
                  onClick={() => void runPreview(columnMap)}
                  disabled={busy !== null}
                >
                  Použít přiřazení
                </button>
                {aiAvailable ? (
                  <button type="button" onClick={() => void askAiForMapping()} disabled={busy !== null}>
                    {busy === "ai" ? "Ptám se…" : "Nechat navrhnout AI"}
                  </button>
                ) : null}
              </div>
            </details>
          ) : null}

          {preview.summary ? (
            <>
              <ul className="import-tabs">
                {TABS.map((item) => {
                  const count =
                    item.key === "new"
                      ? preview.summary!.ready
                      : item.key === "review"
                        ? preview.summary!.review
                        : preview.summary!.duplicates;
                  return (
                    <li key={item.key}>
                      <button
                        type="button"
                        className={`chip${tab === item.key ? " is-on" : ""}`}
                        aria-pressed={tab === item.key}
                        onClick={() => setTab(item.key)}
                      >
                        {item.label} · {count}
                      </button>
                    </li>
                  );
                })}
              </ul>

              {tab === "review" ? (
                <label className="paid-toggle">
                  <input
                    type="checkbox"
                    checked={includeReview}
                    onChange={(event) => setIncludeReview(event.target.checked)}
                  />
                  <span>importovat i řádky ke schválení</span>
                </label>
              ) : null}

              {shown.length === 0 ? (
                <p className="empty-note">
                  {tab === "duplicate"
                    ? "Žádné duplicity — v tomhle souboru není nic, co už v numo je."
                    : tab === "review"
                      ? "Všechny řádky mají kategorii z pravidel."
                      : "Nic k přidání."}
                </p>
              ) : (
                <ul className="crud-list">
                  {shown.slice(0, 100).map((row) => (
                    <li key={`${row.line}-${row.date}`} className="crud-row">
                      <span className="crud-main">
                        <span className="crud-title">{row.merchant || row.description || "—"}</span>
                        <span className="crud-meta">
                          {row.date}
                          {row.categoryName ? ` · ${row.categoryName}` : ""}
                          {row.note ? ` · ${row.note}` : ""}
                        </span>
                      </span>
                      <span className="numo-numeric crud-amount">
                        {formatCzk(row.amount, { sign: row.amount > 0 })}
                      </span>
                      <span className="crud-actions crud-actions-empty" />
                    </li>
                  ))}
                </ul>
              )}

              {shown.length > 100 ? (
                <p className="seed-hint">
                  Zobrazeno prvních 100 z {shown.length}. Importuje se všechno.
                </p>
              ) : null}

              {preview.errors && preview.errors.length > 0 ? (
                <details className="import-errors">
                  <summary>
                    {preview.summary.errors} řádků se nepodařilo přečíst
                  </summary>
                  <ul>
                    {preview.errors.map((error) => (
                      <li key={error.line}>
                        řádek {error.line}: {error.reason}
                      </li>
                    ))}
                  </ul>
                </details>
              ) : null}

              <table className="import-totals">
                <caption>Kontrolní součty — porovnej s výpisem z banky</caption>
                <thead>
                  <tr>
                    <th scope="col">Měsíc</th>
                    <th scope="col">Řádků</th>
                    <th scope="col">Přišlo</th>
                    <th scope="col">Utraceno</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.summary.months.map((month) => (
                    <tr key={month.month}>
                      <td>{month.month}</td>
                      <td className="numo-numeric">{month.rows}</td>
                      <td className="numo-numeric">{formatCzk(month.income)}</td>
                      <td className="numo-numeric">{formatCzk(month.expenses)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="crud-fields">
                <label className="crud-field is-half">
                  <span className="crud-label">Zapamatovat formát jako</span>
                  <input
                    type="text"
                    placeholder="Air Bank — běžný účet"
                    value={profileName}
                    onChange={(event) => setProfileName(event.target.value)}
                  />
                  <span className="crud-hint">
                    Příště se stejný výpis načte bez ptaní.
                  </span>
                </label>
              </div>

              <div className="crud-form-actions">
                <button
                  type="button"
                  className="is-primary"
                  disabled={busy !== null}
                  onClick={() => void commit()}
                >
                  {busy === "commit"
                    ? "Importuji…"
                    : `Importovat ${
                        preview.summary.ready +
                        (includeReview ? preview.summary.review : 0)
                      } transakcí`}
                </button>
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
