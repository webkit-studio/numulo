"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";
import { formatCzk, halereToCzk } from "@/lib/money";

interface Candidate {
  id: number;
  date: string;
  amount: number;
  label: string;
}

/**
 * Statement rows that look like repayments but name no creditor.
 *
 * numo finds them; the household says which debt each one belongs to. One
 * click books it and takes the money off the balance.
 */
export function LinkPayments({
  debts,
}: {
  debts: { id: number; creditor: string }[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState<Set<number>>(new Set());

  if (debts.length === 0) return null;

  async function load() {
    setLoading(true);
    try {
      const response = await fetch(apiUrl("/api/debts/candidates"));
      const data = (await response.json()) as {
        candidates?: Candidate[];
        error?: string;
      };
      if (!response.ok) {
        toast.show(data.error ?? "Nepovedlo se to.", { tone: "danger" });
        return;
      }
      setCandidates(data.candidates ?? []);
    } catch {
      toast.show("Server neodpověděl.", { tone: "danger" });
    } finally {
      setLoading(false);
    }
  }

  async function link(candidate: Candidate, debtId: number) {
    const result = await postJson<{ remaining: number; cleared: boolean }>(
      apiUrl("/api/debts/payments"),
      {
        debtId,
        transactionId: candidate.id,
        amount: halereToCzk(candidate.amount),
        date: candidate.date,
        note: "z výpisu",
      },
    );

    if (!result.ok) {
      toast.show(result.error ?? "Nepovedlo se to.", { tone: "danger" });
      return;
    }

    setDone((current) => new Set(current).add(candidate.id));
    toast.show(
      result.data?.cleared
        ? "Splátka zapsaná — dluh je splacený."
        : `Splátka zapsaná — zbývá ${formatCzk(result.data?.remaining ?? 0)}.`,
      { tone: "success" },
    );
    router.refresh();
  }

  return (
    <div className="detect">
      <button type="button" onClick={() => void load()} disabled={loading}>
        {loading ? "Hledám…" : "Nabídnout splátky z výpisu"}
      </button>

      {candidates === null ? (
        <p className="seed-hint">
          Ve výpisu stojí jen „SPLÁTKA DLUHU", což neříká komu. Najdu je a ty
          u každé vybereš dluh — hádat by znamenalo odepsat je někomu jinému.
        </p>
      ) : candidates.filter((item) => !done.has(item.id)).length === 0 ? (
        <p className="empty-note">Žádné nezapsané splátky ve výpisu.</p>
      ) : (
        <ul className="crud-list">
          {candidates
            .filter((item) => !done.has(item.id))
            .map((candidate) => (
              <li key={candidate.id} className="crud-row">
                <span className="crud-main">
                  <span className="crud-title">{candidate.label}</span>
                  <span className="crud-meta">{candidate.date}</span>
                </span>
                <span className="numo-numeric crud-amount">
                  {formatCzk(candidate.amount)}
                </span>
                <span className="crud-actions">
                  <select
                    defaultValue=""
                    aria-label={`Ke kterému dluhu patří ${candidate.label}`}
                    onChange={(event) => {
                      const debtId = Number(event.target.value);
                      if (Number.isInteger(debtId) && debtId > 0) {
                        void link(candidate, debtId);
                      }
                    }}
                  >
                    <option value="">přiřadit k dluhu…</option>
                    {debts.map((debt) => (
                      <option key={debt.id} value={debt.id}>
                        {debt.creditor}
                      </option>
                    ))}
                  </select>
                </span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
