"use client";

import { useActionState, useState } from "react";
import { saveSavings } from "@/app/actions/household";
import { emptyState } from "@/app/actions/state";
import { SubmitButton } from "@/components/submit-button";
import { formatCzk, halereToCzk } from "@/lib/money";

/**
 * "Tento měsíc chceme ušetřit" — a fixed amount, or a share of the budget.
 *
 * Both boxes stay on screen with the unit outside them, so switching between
 * the two is a radio click rather than a re-read of the form. The closing line
 * does the percentage arithmetic live, because "10 %" is not a number anyone
 * can subtract from their remaining balance in their head.
 */
export function SavingsForm({
  householdId,
  mode,
  value,
  monthIncome,
}: {
  householdId: string;
  mode: "amount" | "percent";
  value: number;
  /** Income credited this month — what a percentage is a percentage OF. */
  monthIncome: number;
}) {
  const [state, action] = useActionState(saveSavings, emptyState);

  const [chosen, setChosen] = useState<"amount" | "percent">(mode);
  const [amount, setAmount] = useState(
    mode === "amount" ? String(halereToCzk(value)) : String(halereToCzk(monthIncome * 0.1)),
  );
  const [percent, setPercent] = useState(mode === "percent" ? String(value) : "10");

  const preview =
    chosen === "amount"
      ? Math.round(Number(amount.replace(",", ".")) * 100) || 0
      : Math.round((Math.max(0, monthIncome) * (Number(percent.replace(",", ".")) || 0)) / 100);

  return (
    <form action={action} className="savings">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="mode" value={chosen} />
      <input type="hidden" name="value" value={chosen === "amount" ? amount : percent} />

      <p className="savings-lead">Tento měsíc chceme ušetřit:</p>

      <label className="savings-option">
        <input
          type="radio"
          name="savingsMode"
          checked={chosen === "amount"}
          onChange={() => setChosen("amount")}
        />
        <span>částku</span>
        <span className="field-box">
          <input
            className="input"
            type="number"
            min="0"
            inputMode="numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            onFocus={() => setChosen("amount")}
            aria-label="Částka ke spoření"
          />
          <span className="field-unit">Kč</span>
        </span>
      </label>

      <label className="savings-option">
        <input
          type="radio"
          name="savingsMode"
          checked={chosen === "percent"}
          onChange={() => setChosen("percent")}
        />
        <span>% z příjmů</span>
        <span className="field-box">
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            inputMode="numeric"
            value={percent}
            onChange={(event) => setPercent(event.target.value)}
            onFocus={() => setChosen("percent")}
            aria-label="Procento rozpočtu ke spoření"
          />
          <span className="field-unit">%</span>
        </span>
      </label>

      <p className="savings-close">
        tento měsíc ušetříme <strong className="num">{formatCzk(preview)}</strong>
      </p>

      {state.error ? <p className="form-error">{state.error}</p> : null}

      <SubmitButton className="btn btn-primary btn-small">Uložit spoření</SubmitButton>
    </form>
  );
}
