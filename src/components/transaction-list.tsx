"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { TransactionRow } from "@/lib/data/queries";
import { apiUrl } from "@/lib/base-path";
import { formatCzk } from "@/lib/money";
import { useToast } from "./toast/toast";
import { formatDayMonth } from "./money";

export interface CategoryOption {
  id: number;
  name: string;
  color: string;
}

/** Groups by day, newest first — the shape a bank statement is read in. */
export function TransactionList({
  transactions,
  categories = [],
  editable = true,
  emptyNote = "Žádné transakce.",
}: {
  transactions: TransactionRow[];
  categories?: CategoryOption[];
  editable?: boolean;
  emptyNote?: string;
}) {
  if (transactions.length === 0) {
    return <p className="empty-note">{emptyNote}</p>;
  }

  const byDay = new Map<string, TransactionRow[]>();
  for (const row of transactions) {
    const group = byDay.get(row.date) ?? [];
    group.push(row);
    byDay.set(row.date, group);
  }

  return (
    <div className="tx-groups">
      {[...byDay.entries()].map(([date, rows]) => {
        const dayTotal = rows.reduce(
          (sum, row) => (row.amount < 0 ? sum - row.amount : sum),
          0,
        );

        return (
          <section key={date} className="tx-group">
            <header className="tx-group-head">
              <h3>{formatDayMonth(date)}</h3>
              {dayTotal > 0 ? (
                <span className="numo-numeric tx-day-total">
                  {formatCzk(dayTotal)}
                </span>
              ) : null}
            </header>

            <ul className="tx-list">
              {rows.map((row) => (
                <Row
                  key={row.id}
                  row={row}
                  categories={categories}
                  editable={editable && categories.length > 0}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Row({
  row,
  categories,
  editable,
}: {
  row: TransactionRow;
  categories: CategoryOption[];
  editable: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  async function patch(
    body: Record<string, unknown>,
    describe: (result: { changed: number; learned: number; learnedFrom: string | null }) => string,
  ) {
    setBusy(true);
    try {
      const response = await fetch(apiUrl("/api/transactions"), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: [row.id], ...body }),
      });
      const data = (await response.json()) as {
        changed?: number;
        learned?: number;
        learnedFrom?: string | null;
        error?: string;
      };

      if (!response.ok) {
        toast.show(data.error ?? "Nepovedlo se to.", { tone: "danger" });
        return;
      }

      toast.show(
        describe({
          changed: data.changed ?? 0,
          learned: data.learned ?? 0,
          learnedFrom: data.learnedFrom ?? null,
        }),
        { tone: "success" },
      );
      startTransition(() => router.refresh());
    } catch {
      toast.show("Server neodpověděl.", { tone: "danger" });
    } finally {
      setBusy(false);
    }
  }

  function onCategory(event: React.ChangeEvent<HTMLSelectElement>) {
    const value = event.target.value;
    const categoryId = value === "" ? null : Number(value);
    const name = categories.find((c) => c.id === categoryId)?.name ?? "bez kategorie";

    void patch({ categoryId, learn: categoryId !== null }, (result) =>
      // The count of *other* rows the new rule moved is the whole point of
      // learning it — say it, or the feature is invisible.
      result.learned > 0
        ? `Přesunuto do ${name} · pravidlo pro „${result.learnedFrom}" srovnalo ${result.learned} dalších`
        : `Přesunuto do ${name}`,
    );
  }

  return (
    <li className={`tx-row${busy || pending ? " is-busy" : ""}`}>
      <span className="tx-main">
        <span className="tx-merchant">
          {row.merchant || row.description || "—"}
        </span>
        <span className="tx-meta">
          {editable ? (
            <span
              className={`tx-chip tx-chip-select${row.categoryId ? "" : " is-empty"}`}
            >
              <span
                className="envelope-dot"
                style={{ background: row.categoryColor ?? "transparent" }}
                aria-hidden="true"
              />
              <select
                value={row.categoryId ?? ""}
                onChange={onCategory}
                disabled={busy}
                aria-label={`Kategorie pro ${row.merchant ?? "transakci"}`}
              >
                <option value="">bez kategorie</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </span>
          ) : row.categoryName ? (
            <span className="tx-chip">
              <span
                className="envelope-dot"
                style={{ background: row.categoryColor ?? "" }}
                aria-hidden="true"
              />
              {row.categoryName}
            </span>
          ) : (
            <span className="tx-chip is-empty">bez kategorie</span>
          )}

          {row.ownerName ? (
            <span className="tx-owner">{row.ownerName}</span>
          ) : null}
          {row.isBusiness ? (
            <span className="tx-chip is-flag">podnikání</span>
          ) : null}
          {row.isTransfer ? (
            <span className="tx-chip is-flag">převod</span>
          ) : null}

          {editable ? (
            <details className="tx-menu">
              <summary aria-label="Další akce">⋯</summary>
              <div className="tx-menu-body">
                <button
                  type="button"
                  onClick={() =>
                    void patch(
                      { isBusiness: !row.isBusiness, learn: true },
                      (result) =>
                        `${row.isBusiness ? "Zpět do domácnosti" : "Označeno jako podnikání"}${
                          result.learned > 0 ? ` · a ${result.learned} dalších` : ""
                        }`,
                    )
                  }
                >
                  {row.isBusiness
                    ? "Vrátit do domácnosti"
                    : "Označit jako podnikání"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void patch(
                      { isTransfer: !row.isTransfer, learn: true },
                      (result) =>
                        `${row.isTransfer ? "Už to není převod" : "Označeno jako převod"}${
                          result.learned > 0 ? ` · a ${result.learned} dalších` : ""
                        }`,
                    )
                  }
                >
                  {row.isTransfer ? "Zrušit převod" : "Označit jako převod"}
                </button>
              </div>
            </details>
          ) : null}
        </span>
      </span>

      <span
        className={`numo-numeric tx-amount${row.amount > 0 ? " is-income" : ""}`}
      >
        {formatCzk(row.amount, { sign: row.amount > 0 })}
      </span>
    </li>
  );
}
