"use client";

import { useState, useTransition } from "react";
import { setSubscriptionSimulated } from "@/app/actions/recurring";
import { CrudList, type CrudRow } from "@/components/crud-list";
import { Money } from "@/components/money";
import { useToast } from "@/components/toast";
import { simulateCancellation } from "@/lib/recurring/detect";
import { formatCzk } from "@/lib/money";

export interface SubscriptionRow {
  id: string;
  name: string;
  amount: number;
  day: number | null;
  simulated: boolean;
  values: Record<string, unknown>;
}

/**
 * Subscriptions, with the "what if we cancelled this" switch.
 *
 * ⊘ is a question, not a decision: the row goes grey and struck through and
 * the saving adds up at the bottom, but the subscription is still there in the
 * morning. The bin is what actually removes one — which is why ⊘ comes first
 * in the row, where a hesitant hand lands.
 */
export function Subscriptions({
  householdId,
  rows,
}: {
  householdId: string;
  rows: SubscriptionRow[];
}) {
  const toast = useToast();
  const [busy, startBusy] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const cancelled = rows.filter((row) => row.simulated);
  const saving = simulateCancellation(
    rows.map((row) => ({ id: row.id, amount: row.amount })),
    cancelled.map((row) => row.id),
  );

  function toggle(row: SubscriptionRow) {
    setPendingId(row.id);
    startBusy(async () => {
      await setSubscriptionSimulated(row.id, !row.simulated);
      setPendingId(null);
      toast.show(
        row.simulated
          ? `${row.name} — simulace zrušena`
          : `Zkoušíme zrušit ${row.name} — ušetříš ${formatCzk(row.amount)}/měs`,
      );
    });
  }

  function clearAll() {
    startBusy(async () => {
      await Promise.all(cancelled.map((row) => setSubscriptionSimulated(row.id, false)));
      toast.show("Simulace zrušena");
    });
  }

  const crudRows: CrudRow[] = rows.map((row) => ({
    id: row.id,
    values: row.values,
    view: (
      <>
        <span className={`crud-name${row.simulated ? " is-struck" : ""}`}>
          {row.name}
          {row.day ? <span className="crud-day">{row.day}.</span> : null}
        </span>
        <span className={`crud-amount${row.simulated ? " is-struck" : ""}`}>
          <Money value={row.amount} tone="plain" />
        </span>
      </>
    ),
    before: (
      <button
        type="button"
        className={`icon-btn${row.simulated ? " is-on" : ""}`}
        title="Simulace zrušení — co kdyby"
        aria-pressed={row.simulated}
        aria-label={`Simulovat zrušení ${row.name}`}
        disabled={busy && pendingId === row.id}
        onClick={() => toggle(row)}
      >
        ⊘
      </button>
    ),
  }));

  return (
    <>
      <CrudList
        listKey="subscriptions"
        householdId={householdId}
        rows={crudRows}
        empty="Žádná předplatná. Přidej je ručně, nebo počkej, až je Numulo najde ve výpisu."
      />

      {cancelled.length > 0 ? (
        <div className="simulation">
          <p>
            zkoušíš zrušit {cancelled.length} — ušetříš{" "}
            <b className="num pos">{formatCzk(saving.monthly, { sign: true })}/měs</b>
          </p>
          <p className="simulation-year">
            {formatCzk(saving.yearly, { sign: true })} za rok
          </p>
          <button type="button" className="btn-quiet" disabled={busy} onClick={clearAll}>
            zrušit simulaci
          </button>
        </div>
      ) : null}
    </>
  );
}
