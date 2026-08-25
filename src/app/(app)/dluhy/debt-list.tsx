"use client";

import { useState, useTransition } from "react";
import { recordDebtPayment } from "@/app/actions/debts";
import { CrudList, type CrudRow } from "@/components/crud-list";
import { Money } from "@/components/money";
import { useToast } from "@/components/toast";
import { monthLabel } from "@/lib/date";

export interface DebtRow {
  id: string;
  creditor: string;
  total: number;
  remaining: number;
  installment: number;
  day: number | null;
  account: string | null;
  vs: string | null;
  cleanBy: string | null;
  values: Record<string, unknown>;
}

/**
 * One debt is a block, not a line: who, how much is gone, how much is left,
 * what goes out each month, and the account number to type into the bank.
 *
 * "Zaznamenat platbu" sits with the debt rather than on a screen of its own —
 * it is the one action anyone comes to this page to perform, and it should not
 * need a second click to reach.
 */
export function DebtList({
  householdId,
  rows,
  today,
}: {
  householdId: string;
  rows: DebtRow[];
  today: string;
}) {
  const crudRows: CrudRow[] = rows.map((row) => ({
    id: row.id,
    values: row.values,
    view: <DebtBlock row={row} today={today} />,
  }));

  return (
    <CrudList
      listKey="debts"
      householdId={householdId}
      rows={crudRows}
      empty="Žádné dluhy. 🌱"
    />
  );
}

function DebtBlock({ row, today }: { row: DebtRow; today: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(Math.round(row.installment / 100)));
  const [date, setDate] = useState(today);
  const [saving, startSaving] = useTransition();

  const paid = Math.max(0, row.total - row.remaining);
  const percent = row.total === 0 ? 0 : Math.min(100, (paid / row.total) * 100);

  function submit() {
    startSaving(async () => {
      const result = await recordDebtPayment(row.id, row.creditor, amount, date);
      toast.show(result.notice ?? result.error ?? "Hotovo", result.error ? "danger" : "success");
      if (!result.error) setOpen(false);
    });
  }

  return (
    <div className="debt">
      <div className="debt-head">
        <span className="debt-creditor">{row.creditor}</span>
        <span className="debt-remaining">
          zbývá <Money value={row.remaining} />
        </span>
      </div>

      <p className="debt-progress-note">
        splaceno <Money value={paid} tone="plain" /> z <Money value={row.total} tone="plain" />
      </p>

      <div className="bar">
        <span className="bar-fill" style={{ width: `${percent}%` }} />
      </div>

      <p className="debt-meta">
        <Money value={row.installment} tone="plain" />/měs
        {row.day ? <> · {row.day}. v měsíci</> : null}
        {row.cleanBy ? <> · čistý ~<b>{monthLabel(row.cleanBy)}</b></> : null}
      </p>

      {row.account || row.vs ? (
        <p className="debt-account mono">
          {row.account ?? ""}
          {row.vs ? ` · VS ${row.vs}` : ""}
        </p>
      ) : null}

      {open ? (
        <div className="debt-payment">
          <span className="field-box">
            <input
              className="input"
              type="number"
              min="1"
              inputMode="numeric"
              value={amount}
              autoFocus
              onChange={(event) => setAmount(event.target.value)}
              aria-label="Částka platby"
            />
            <span className="field-unit">Kč</span>
          </span>
          <input
            className="input"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            aria-label="Datum platby"
          />
          <button type="button" className="btn btn-small" disabled={saving} onClick={submit}>
            Zaznamenat
          </button>
          <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>zrušit</button>
        </div>
      ) : row.remaining > 0 ? (
        <button type="button" className="btn-quiet debt-record" onClick={() => setOpen(true)}>
          zaznamenat platbu
        </button>
      ) : (
        <p className="debt-done">splaceno 🌱</p>
      )}
    </div>
  );
}
