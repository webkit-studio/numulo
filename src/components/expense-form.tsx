"use client";

import { useActionState, useEffect, useState } from "react";
import { addManualTransaction } from "@/app/actions/transactions";
import { emptyState } from "@/app/actions/state";
import { SubmitButton } from "@/components/submit-button";
import { useToast } from "@/components/toast";

export interface ExpenseCategory {
  id: string;
  name: string;
  color: string;
}

/**
 * Zapsat výdaj — the cash payment that will never appear in a statement.
 *
 * Amount first, because that is what someone remembers on the way out of the
 * shop. Categories are chips rather than a dropdown: on a phone, one tap on a
 * visible thing beats two on a hidden list, and there are ten of them, not a
 * hundred.
 */
export function ExpenseForm({
  householdId,
  categories,
  today,
  onSaved,
}: {
  householdId: string;
  categories: ExpenseCategory[];
  today: string;
  onSaved?: () => void;
}) {
  const toast = useToast();
  const [state, action] = useActionState(addManualTransaction, emptyState);
  const [categoryId, setCategoryId] = useState("");
  const [direction, setDirection] = useState<"expense" | "income">("expense");

  useEffect(() => {
    if (state.notice) {
      toast.show(state.notice);
      onSaved?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form action={action} className="expense">
      <input type="hidden" name="householdId" value={householdId} />
      <input type="hidden" name="categoryId" value={categoryId} />
      <input type="hidden" name="direction" value={direction} />

      <label className="field field-money expense-amount">
        <span className="field-label">Částka</span>
        <span className="field-box">
          <input
            className="input input-big"
            type="number"
            name="amount"
            min="0"
            step="1"
            inputMode="decimal"
            autoFocus
            required
            placeholder="0"
          />
          <span className="field-unit">Kč</span>
        </span>
      </label>

      <label className="field">
        <span className="field-label">Za co</span>
        <input className="input" type="text" name="merchant" required placeholder="Pekárna" />
      </label>

      <label className="field">
        <span className="field-label">Kdy</span>
        <input className="input" type="date" name="date" defaultValue={today} required />
      </label>

      <div className="chips" role="group" aria-label="Kategorie">
        {categories.map((category) => (
          <button
            key={category.id}
            type="button"
            className={`chip${categoryId === category.id ? " is-on" : ""}`}
            aria-pressed={categoryId === category.id}
            onClick={() => setCategoryId(categoryId === category.id ? "" : category.id)}
          >
            <span className="dot" style={{ background: category.color }} aria-hidden="true" />
            {category.name}
          </button>
        ))}
      </div>

      <div className="chips" role="group" aria-label="Směr">
        <button
          type="button"
          className={`chip chip-dashed${direction === "expense" ? " is-on" : ""}`}
          aria-pressed={direction === "expense"}
          onClick={() => setDirection("expense")}
        >
          výdaj
        </button>
        <button
          type="button"
          className={`chip chip-dashed${direction === "income" ? " is-on" : ""}`}
          aria-pressed={direction === "income"}
          onClick={() => setDirection("income")}
        >
          příjem
        </button>
      </div>

      {state.error ? <p className="form-error">{state.error}</p> : null}

      <SubmitButton className="btn btn-primary">Uložit</SubmitButton>
    </form>
  );
}
