"use client";

import { useState } from "react";
import { ExpenseForm, type ExpenseCategory } from "@/components/expense-form";

/**
 * "+ přidat záznam" where the records live.
 *
 * A separate page for writing down one payment made people leave the list
 * they were just reading. The dialog opens over it, saves, and the list
 * underneath is already revalidated when it closes.
 */
export function AddRecord({
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
      <button type="button" className="btn btn-primary" onClick={() => setOpen(true)}>
        + přidat záznam
      </button>

      {open ? (
        <div className="dialog-backdrop" role="dialog" aria-modal="true" aria-label="Přidat záznam">
          <button
            type="button"
            className="sheet-close-area"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div className="dialog fade">
            <div className="sheet-head">
              <h2 className="card-title">Přidat záznam</h2>
              <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>
                zavřít
              </button>
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
