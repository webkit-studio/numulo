"use client";

import { useState, useTransition } from "react";
import { confirmRow, discardRow } from "@/app/actions/import";
import { setFlag } from "@/app/actions/transactions";
import { Money } from "@/components/money";
import { useToast } from "@/components/toast";
import { shortDate } from "@/lib/date";

export interface ReviewRow {
  id: string;
  date: string;
  merchant: string;
  amount: number;
}

/**
 * "Ke schválení" — the rows no rule could name.
 *
 * Four answers, and each is final: it is a household payment, it is business,
 * it is a transfer between our own accounts, or it should never have been
 * here. The row disappears when it is answered and the count above drops,
 * so the tab empties as it is worked through.
 */
export function ReviewRows({ rows }: { rows: ReviewRow[] }) {
  const toast = useToast();
  const [done, setDone] = useState<Set<string>>(new Set());
  const [busy, startBusy] = useTransition();

  const left = rows.filter((row) => !done.has(row.id));

  if (left.length === 0) {
    return <p className="empty">Vyřízeno — nic tu nezůstalo. 🌱</p>;
  }

  function resolve(row: ReviewRow, work: () => Promise<unknown>, message: string) {
    startBusy(async () => {
      await work();
      setDone((current) => new Set(current).add(row.id));
      toast.show(message);
    });
  }

  return (
    <ul className="review">
      {left.map((row) => (
        <li key={row.id} className="review-row">
          <span className="review-main">
            <span className="review-name">{row.merchant}</span>
            <span className="review-date">{shortDate(row.date)}</span>
          </span>
          <span className="review-amount"><Money value={row.amount} /></span>

          <span className="review-actions">
            <button
              type="button"
              className="btn btn-small"
              disabled={busy}
              onClick={() => resolve(row, () => confirmRow(row.id), `${row.merchant} — přidáno`)}
            >
              Přidat
            </button>
            <button
              type="button"
              className="flag"
              disabled={busy}
              onClick={() =>
                resolve(
                  row,
                  async () => {
                    await setFlag(row.id, "is_business", true);
                    await confirmRow(row.id);
                  },
                  "Označeno jako podnikání — mimo součty domácnosti",
                )
              }
            >
              podnikání
            </button>
            <button
              type="button"
              className="flag"
              disabled={busy}
              onClick={() =>
                resolve(
                  row,
                  async () => {
                    await setFlag(row.id, "is_transfer", true);
                    await confirmRow(row.id);
                  },
                  "Označeno jako převod — mimo všechny metriky",
                )
              }
            >
              převod
            </button>
            <button
              type="button"
              className="btn-quiet"
              disabled={busy}
              onClick={() => resolve(row, () => discardRow(row.id), `${row.merchant} — zahozeno`)}
            >
              Zahodit
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
