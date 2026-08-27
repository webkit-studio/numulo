"use client";

import { useState } from "react";
import { ExpenseForm, type ExpenseCategory } from "./expense-form";

/**
 * The floating + above the tab bar, and the sheet it opens.
 *
 * Phone only — on a desktop the same form has its own page and a sidebar link.
 * The sheet closes itself once the payment is saved, because the next thing
 * anyone wants to see is the number it just changed.
 */
export function QuickAdd({
  householdId,
  categories,
  today,
}: {
  householdId: string;
  categories: ExpenseCategory[];
  today: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="fab"
        aria-label="Přidat záznam"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        +
      </button>

      {open ? (
        <div className="sheet-backdrop" role="dialog" aria-modal="true" aria-label="Přidat záznam">
          {/* Tapping the dark area is the way out that needs no explaining. */}
          <button type="button" className="sheet-close-area" aria-hidden="true" onClick={() => setOpen(false)} />
          <div className="sheet fade">
            <div className="sheet-head">
              <h2 className="card-title">Přidat záznam</h2>
              <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>zavřít</button>
            </div>
            <ExpenseForm
              householdId={householdId}
              categories={categories}
              today={today}
              onSaved={() => setOpen(false)}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
