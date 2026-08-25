"use client";

import { useTransition } from "react";
import { acceptDetected, dismissDetected } from "@/app/actions/recurring";
import { useToast } from "@/components/toast";
import { formatCzk } from "@/lib/money";
import type { DetectedSubscription } from "@/lib/recurring/detect";

/**
 * "Vypadá to na předplatné" — the one place Numulo volunteers something.
 *
 * The claim is arithmetic and checkable: this merchant charged about this much
 * in this many separate months. Both answers are one click, and both are
 * remembered, so the card empties out instead of nagging.
 */
export function Detected({
  householdId,
  candidates,
}: {
  householdId: string;
  candidates: DetectedSubscription[];
}) {
  const toast = useToast();
  const [busy, startBusy] = useTransition();

  if (candidates.length === 0) return null;

  return (
    <section className="card card-amber">
      <div className="card-head"><h2 className="card-title">Auto-detekce</h2></div>

      <ul className="detected">
        {candidates.map((candidate) => (
          <li key={candidate.name}>
            <p className="detected-claim">
              Vypadá to na předplatné — <b>{candidate.name}</b>{" "}
              <b className="num">{formatCzk(candidate.amount)}</b>, {candidate.months.length}×
              {candidate.day ? ` kolem ${candidate.day}.` : ""}. Přidat mezi předplatná?
            </p>
            <div className="detected-actions">
              <button
                type="button"
                className="btn btn-small"
                disabled={busy}
                onClick={() =>
                  startBusy(async () => {
                    const result = await acceptDetected(
                      householdId,
                      candidate.name,
                      candidate.amount,
                      candidate.day,
                    );
                    toast.show(result.notice ?? result.error ?? "", result.error ? "danger" : "success");
                  })
                }
              >
                Přidat
              </button>
              <button
                type="button"
                className="btn-quiet"
                disabled={busy}
                onClick={() =>
                  startBusy(async () => {
                    const result = await dismissDetected(householdId, candidate.name);
                    toast.show(result.notice ?? result.error ?? "", result.error ? "danger" : "success");
                  })
                }
              >
                Není předplatné
              </button>
            </div>
          </li>
        ))}
      </ul>

      <p className="detected-note">Skutečné platby se automaticky párují na pravidelné.</p>
    </section>
  );
}
