"use client";

import { useState, useTransition } from "react";
import { setPaid, type Kind } from "@/app/actions/recurring";
import { CrudList, type CrudRow } from "@/components/crud-list";
import { Money } from "@/components/money";
import { useToast } from "@/components/toast";
import type { ListKey } from "@/lib/lists/registry";
import { monthNameOnly } from "@/lib/date";

export interface PayableRow {
  id: string;
  name: string;
  amount: number;
  /** Day of the month for monthly items, month number for yearly ones. */
  day: number | null;
  dueMonth: number | null;
  paid: boolean;
  /** False for a row that cannot be paid this month — no checkbox is shown. */
  tickable?: boolean;
  values: Record<string, unknown>;
}

/**
 * A checklist of things that go out every month.
 *
 * The tick is the state — no label, no save button. Paid is recorded per
 * month, so ticking August says nothing about September, and the counter in
 * the heading is simply how many of these are done.
 */
export function PaidList({
  householdId,
  listKey,
  kind,
  month,
  rows,
  empty,
}: {
  householdId: string;
  listKey: ListKey;
  kind: Kind;
  month: string;
  rows: PayableRow[];
  empty: string;
}) {
  const toast = useToast();
  const [busy, startBusy] = useTransition();
  const [pendingId, setPendingId] = useState<string | null>(null);

  function toggle(row: PayableRow) {
    setPendingId(row.id);
    startBusy(async () => {
      const result = await setPaid(householdId, kind, row.id, month, !row.paid);
      setPendingId(null);
      toast.show(
        result.error ?? (row.paid ? `${row.name} — zpět mezi nezaplacené` : `${row.name} — zaplaceno`),
        result.error ? "danger" : "success",
      );
    });
  }

  const crudRows: CrudRow[] = rows.map((row) => ({
    id: row.id,
    values: row.values,
    view: (
      <>
        <label className="payable">
          {row.tickable === false ? (
            <span className="payable-gap" aria-hidden="true" />
          ) : (
            <input
              type="checkbox"
              checked={row.paid}
              disabled={busy && pendingId === row.id}
              onChange={() => toggle(row)}
              aria-label={`${row.name} zaplaceno`}
            />
          )}
          <span className={`crud-name${row.paid ? " is-paid" : ""}`}>
            {row.name}
            {row.day ? <span className="crud-day">{row.day}.</span> : null}
            {row.dueMonth ? (
              <span className="badge">{monthNameOnly(`2026-${String(row.dueMonth).padStart(2, "0")}`)}</span>
            ) : null}
          </span>
        </label>
        <span className="crud-amount">
          <Money value={row.amount} tone="plain" />
        </span>
      </>
    ),
  }));

  return <CrudList listKey={listKey} householdId={householdId} rows={crudRows} empty={empty} />;
}
