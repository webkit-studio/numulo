"use client";

import { useActionState } from "react";
import { saveHouseholdSettings } from "@/app/actions/household";
import { emptyState } from "@/app/actions/state";
import { SubmitButton } from "@/components/submit-button";

export function SettingsForm({
  householdId,
  name,
  monthlyBudget,
  initialBalance,
  initialBalanceDate,
  kind,
}: {
  householdId: string;
  name: string;
  monthlyBudget: number;
  initialBalance: number;
  initialBalanceDate: string | null;
  kind: "household" | "business";
}) {
  const [state, action] = useActionState(saveHouseholdSettings, emptyState);

  return (
    <form className="stack-form" action={action}>
      <input type="hidden" name="householdId" value={householdId} />

      <div className="form-grid">
        <label className="field">
          <span className="field-label">Název účtu</span>
          <input className="input" type="text" name="name" defaultValue={name} required />
        </label>

        <label className="field">
          <span className="field-label">Typ</span>
          <input
            className="input"
            type="text"
            value={kind === "household" ? "osobní" : "podnikatelský"}
            readOnly
            disabled
          />
          <span className="field-hint">podnikatelský připravujeme</span>
        </label>

        <label className="field">
          <span className="field-label">Měsíční rozpočet (Kč)</span>
          <input
            className="input num"
            type="number"
            name="monthlyBudget"
            step="1"
            min="0"
            inputMode="decimal"
            defaultValue={monthlyBudget}
            required
          />
        </label>

        <label className="field">
          <span className="field-label">Počáteční stav — hotovost (Kč)</span>
          <input
            className="input num"
            type="number"
            name="initialBalance"
            step="1"
            inputMode="decimal"
            defaultValue={initialBalance}
            required
          />
          <span className="field-hint">
            Kolik je celkem na sledovaných účtech. Bez dluhů — ty se odečtou samy.
          </span>
        </label>

        <label className="field">
          <span className="field-label">…k datu</span>
          <input
            className="input"
            type="date"
            name="initialBalanceDate"
            defaultValue={initialBalanceDate ?? ""}
          />
          <span className="field-hint">
            Hranice historie. Starší transakce sytí průměry, ale Rezervu nemění.
          </span>
        </label>
      </div>

      {state.error ? <p className="auth-error" role="alert">{state.error}</p> : null}
      {state.notice ? <p className="form-notice">{state.notice}</p> : null}

      <div><SubmitButton pendingLabel="Ukládám…">Uložit</SubmitButton></div>
    </form>
  );
}
