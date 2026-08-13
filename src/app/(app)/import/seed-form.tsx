"use client";

import { useState } from "react";
import { apiUrl } from "@/lib/base-path";
import { formatCzk } from "@/lib/money";

interface MonthTotals {
  month: string;
  rows: number;
  income: number;
  expenses: number;
  transfers: number;
}

interface Result {
  parsed: number;
  inserted: number;
  skippedAsDuplicate: number;
  withOwner: number;
  withCategory: number;
  transfers: number;
  lastDate: string | null;
  errors: { line: number; reason: string }[];
  totals: MonthTotals[];
}

export function SeedForm() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);

    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch(apiUrl("/api/admin/seed-import"), {
        method: "POST",
        body: form,
      });
      const body = (await response.json()) as Partial<Result> & {
        error?: string;
      };
      if (!response.ok) setError(body.error ?? "Import se nepovedl.");
      else setResult(body as Result);
    } catch {
      setError("Import se nepovedl — zkontroluj připojení.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <form onSubmit={onSubmit} className="login-form">
        <label htmlFor="file">Master CSV</label>
        <input id="file" name="file" type="file" accept=".csv,text/csv" required />
        <button type="submit" disabled={pending}>
          {pending ? "Importuji…" : "Naimportovat historii"}
        </button>
      </form>

      {error ? (
        <p role="alert" className="login-error">
          {error}
        </p>
      ) : null}

      {result ? (
        <section className="seed-result">
          <h3>Hotovo</h3>
          <ul>
            <li>
              přečteno {result.parsed} řádků, přidáno <strong>{result.inserted}</strong>
            </li>
            <li>
              přeskočeno jako duplicita: {result.skippedAsDuplicate}
              {result.skippedAsDuplicate === 0 ? " (čistý první import)" : null}
            </li>
            <li>s vlastníkem: {result.withOwner} · s kategorií: {result.withCategory}</li>
            <li>interních převodů: {result.transfers}</li>
            <li>historie končí k: {result.lastDate ?? "—"}</li>
            {result.errors.length > 0 ? (
              <li className="login-error">
                vadných řádků: {result.errors.length} (řádek{" "}
                {result.errors
                  .slice(0, 5)
                  .map((e) => e.line)
                  .join(", ")}
                )
              </li>
            ) : (
              <li>vadných řádků: 0</li>
            )}
          </ul>

          <h3>Kontrolní součty po měsících</h3>
          <p className="seed-hint">
            Porovnej proti výpisům. Interní převody jsou mimo příjmy i výdaje.
          </p>
          <table className="seed-table">
            <thead>
              <tr>
                <th>měsíc</th>
                <th>řádků</th>
                <th>převody</th>
                <th>příjmy</th>
                <th>výdaje</th>
              </tr>
            </thead>
            <tbody>
              {result.totals.map((month) => (
                <tr key={month.month}>
                  <td>{month.month}</td>
                  <td className="numo-numeric">{month.rows}</td>
                  <td className="numo-numeric">{month.transfers}</td>
                  <td className="numo-numeric">{formatCzk(month.income)}</td>
                  <td className="numo-numeric">{formatCzk(month.expenses)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </>
  );
}
