"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";
import { formatCzk, halereToCzk } from "@/lib/money";

interface Candidate {
  name: string;
  amount: number;
  day: number | null;
  monthCount: number;
  firstMonth: string;
  lastMonth: string;
  stillRunning: boolean;
}

/**
 * Subscriptions numo found in the statement but nobody has confirmed yet.
 *
 * Loaded on demand rather than on every page view: scanning the whole history
 * is not free, and the answer only changes after an import.
 */
export function DetectedSubscriptions() {
  const router = useRouter();
  const toast = useToast();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [added, setAdded] = useState<Set<string>>(new Set());

  async function scan() {
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/recurring/detect"));
      const data = (await response.json()) as {
        candidates?: Candidate[];
        error?: string;
      };
      if (!response.ok) {
        toast.show(data.error ?? "Hledání se nepovedlo.", { tone: "danger" });
        return;
      }
      setCandidates(data.candidates ?? []);
    } catch {
      toast.show("Server neodpověděl.", { tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  async function confirm(candidate: Candidate) {
    const result = await postJson(apiUrl("/api/subscriptions"), {
      name: candidate.name,
      amount: halereToCzk(candidate.amount),
      day: candidate.day ?? "",
      active: candidate.stillRunning,
      status: "confirmed",
    });

    if (!result.ok) {
      toast.show(result.error ?? "Nepovedlo se přidat.", { tone: "danger" });
      return;
    }

    setAdded((current) => new Set(current).add(candidate.name));
    toast.show(`${candidate.name} přidáno mezi předplatná.`, { tone: "success" });
    router.refresh();
  }

  return (
    <div className="detect">
      <button type="button" onClick={() => void scan()} disabled={loading}>
        {loading ? "Hledám…" : "Najít předplatná ve výpisu"}
      </button>

      {candidates === null ? (
        <p className="seed-hint">
          Projde útraty a najde obchodníky, kteří strhávají skoro stejnou částku
          nejmíň tři měsíce po sobě. Nic se neuloží, dokud to nepotvrdíš.
        </p>
      ) : candidates.length === 0 ? (
        <p className="empty-note">
          Nic dalšího ve výpisu nevypadá jako pravidelná platba.
        </p>
      ) : (
        <ul className="crud-list">
          {candidates.map((candidate) => (
            <li key={`${candidate.name}-${candidate.amount}`} className="crud-row">
              <span className="crud-main">
                <span className="crud-title">
                  {candidate.name}
                  {candidate.stillRunning ? null : (
                    <span className="tx-chip is-flag">možná už zrušené</span>
                  )}
                </span>
                <span className="crud-meta">
                  {candidate.monthCount}× · {candidate.firstMonth} –{" "}
                  {candidate.lastMonth}
                  {candidate.day ? ` · kolem ${candidate.day}.` : ""}
                </span>
              </span>

              <span className="numo-numeric crud-amount">
                {formatCzk(candidate.amount)}
              </span>

              <span className="crud-actions">
                {added.has(candidate.name) ? (
                  <span className="sort-settled">přidáno</span>
                ) : (
                  <button type="button" onClick={() => void confirm(candidate)}>
                    + přidat
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
