"use client";

import { useState, useTransition } from "react";
import { setCategory, setFlag } from "@/app/actions/transactions";
import { Money } from "@/components/money";
import { useToast } from "@/components/toast";
import { dayHeading } from "@/lib/date";
import type { TransactionRow } from "@/lib/data/month";
import type { Member } from "@/lib/data/household";

interface Category {
  id: string;
  name: string;
  color: string;
}

/**
 * The transaction feed, editable in place.
 *
 * Changing a category here is a decision about the merchant, not about this
 * one payment — so it is remembered, and the toast says how many other rows it
 * moved. Marking a row as business or a transfer drops it out of every metric
 * at once; the row dims immediately so the effect is visible, not just claimed.
 */
export function EditableTransactions({
  transactions,
  categories,
  members,
  today,
}: {
  transactions: TransactionRow[];
  categories: Category[];
  members: Member[];
  today: string;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<string | null>(null);

  const initials = new Map(members.map((m) => [m.userId, m.initial]));

  if (transactions.length === 0) {
    return <p className="empty">Žádné transakce neodpovídají filtrům.</p>;
  }

  const byDay = new Map<string, TransactionRow[]>();
  for (const tx of transactions) {
    const group = byDay.get(tx.date) ?? [];
    group.push(tx);
    byDay.set(tx.date, group);
  }

  async function changeCategory(tx: TransactionRow, categoryId: string | null) {
    setBusy(tx.id);
    const result = await setCategory(tx.id, categoryId);
    setBusy(null);

    const name = categories.find((c) => c.id === categoryId)?.name ?? "bez kategorie";
    toast.show(
      result.moved > 0
        ? `Zapamatuji si pravidlo: ${result.merchant} → ${name} · srovnáno ${result.moved} dalších`
        : `Přesunuto do ${name}`,
    );
    startTransition(() => {});
  }

  async function toggle(tx: TransactionRow, flag: "is_business" | "is_transfer") {
    setBusy(tx.id);
    const next = flag === "is_business" ? !tx.isBusiness : !tx.isTransfer;
    await setFlag(tx.id, flag, next);
    setBusy(null);

    toast.show(
      flag === "is_business"
        ? next ? "Označeno jako podnikání — mimo součty domácnosti" : "Zpět do domácnosti"
        : next ? "Označeno jako převod — mimo všechny metriky" : "Už to není převod",
    );
    startTransition(() => {});
  }

  return (
    <div className="tx-groups">
      {[...byDay.entries()].map(([date, rows]) => {
        const total = rows.reduce(
          (sum, tx) =>
            tx.amount < 0 && !tx.isBusiness && !tx.isTransfer ? sum - tx.amount : sum,
          0,
        );

        return (
          <section key={date}>
            <header className="tx-day">
              <h3 className="tx-day-name">{dayHeading(date, today)}</h3>
              {total > 0 ? (
                <span className="tx-day-total"><Money value={total} tone="plain" /></span>
              ) : null}
            </header>

            <ul className="tx-list">
              {rows.map((tx) => {
                const excluded = tx.isBusiness || tx.isTransfer;
                const working = busy === tx.id || pending;

                return (
                  <li key={tx.id} className={`tx-row${excluded ? " is-muted" : ""}${working ? " is-busy" : ""}`}>
                    <span className="avatar" aria-hidden="true">
                      {tx.ownerId ? (initials.get(tx.ownerId) ?? "·") : "·"}
                    </span>

                    <span className="tx-main">
                      <span className="tx-name">{tx.merchant || tx.description || "—"}</span>
                      <span className="tx-meta">
                        <span className="cat-select">
                          <span
                            className="dot"
                            style={{ background: tx.categoryColor ?? "transparent" }}
                            aria-hidden="true"
                          />
                          <select
                            value={tx.categoryId ?? ""}
                            disabled={working}
                            aria-label={`Kategorie pro ${tx.merchant ?? "transakci"}`}
                            onChange={(event) =>
                              void changeCategory(tx, event.target.value === "" ? null : event.target.value)
                            }
                          >
                            <option value="">bez kategorie</option>
                            {categories.map((category) => (
                              <option key={category.id} value={category.id}>{category.name}</option>
                            ))}
                          </select>
                        </span>

                        <button
                          type="button"
                          className={`flag${tx.isBusiness ? " is-on" : ""}`}
                          disabled={working}
                          title="Podnikání — mimo součty domácnosti"
                          aria-pressed={tx.isBusiness}
                          onClick={() => void toggle(tx, "is_business")}
                        >
                          podnikání
                        </button>

                        <button
                          type="button"
                          className={`flag${tx.isTransfer ? " is-on" : ""}`}
                          disabled={working}
                          title="Převod mezi vlastními účty — mimo všechny metriky"
                          aria-pressed={tx.isTransfer}
                          onClick={() => void toggle(tx, "is_transfer")}
                        >
                          převod
                        </button>
                      </span>
                    </span>

                    <span className="tx-amount">
                      <Money value={tx.amount} sign={tx.amount > 0} />
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
