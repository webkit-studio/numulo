"use client";

import { useState } from "react";
import { rotateJoinCode } from "@/app/actions/household";
import { useToast } from "@/components/toast";

/**
 * The code someone types to join this household.
 *
 * Shown in full rather than hidden behind a "reveal": it is meant to be read
 * aloud across a kitchen table, and a code you have to click to see is a code
 * you photograph instead.
 */
export function JoinCode({ householdId, code }: { householdId: string; code: string }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <div className="join-code">
      <code className="join-code-value num">{code}</code>

      <div className="join-code-actions">
        <button
          type="button"
          className="btn"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(code);
              toast.show("Kód zkopírovaný.");
            } catch {
              toast.show("Zkopíruj ho ručně — schránka nedovolila zápis.", "info");
            }
          }}
        >
          Zkopírovat
        </button>

        <button
          type="button"
          className="btn btn-danger"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            await rotateJoinCode(householdId);
            setBusy(false);
            // The old code stops working the moment this returns — say so, or
            // someone will keep passing around a code that no longer opens.
            toast.show("Nový kód vyrobený. Ten starý už neplatí.");
          }}
        >
          {busy ? "Měním…" : "Vyrobit nový"}
        </button>
      </div>
    </div>
  );
}
