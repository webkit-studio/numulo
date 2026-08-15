"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";

export interface RuleRow {
  id: number;
  kindLabel: string;
  pattern: string;
  targetLabel: string;
  createdFrom: string;
}

/**
 * Every rule numo has learned, and a way to unlearn it.
 *
 * Rules are written by clicking a chip and by confirming an AI suggestion, so
 * they accumulate invisibly. Without this list a single mis-click quietly
 * re-labels every future import from that merchant and nothing on screen ever
 * says why.
 */
export function RulesList({ rules }: { rules: RuleRow[] }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState<number | null>(null);

  if (rules.length === 0) {
    return (
      <p className="empty-note">
        Zatím žádná pravidla. Vznikají sama, když u transakce přepneš kategorii.
      </p>
    );
  }

  return (
    <ul className="crud-list">
      {rules.map((rule) => (
        <li key={rule.id} className="crud-row">
          <span className="crud-main">
            <span className="crud-title">
              „{rule.pattern}" → {rule.targetLabel}
            </span>
            <span className="crud-meta">
              {rule.kindLabel} · vzniklo z: {rule.createdFrom}
            </span>
          </span>
          <span className="crud-actions">
            <button
              type="button"
              className="is-danger"
              aria-label={`Smazat pravidlo pro ${rule.pattern}`}
              title="Smazat pravidlo"
              disabled={busy === rule.id}
              onClick={async () => {
                setBusy(rule.id);
                const response = await fetch(apiUrl(`/api/rules?id=${rule.id}`), {
                  method: "DELETE",
                });
                setBusy(null);

                if (!response.ok) {
                  toast.show("Nepovedlo se smazat.", { tone: "danger" });
                  return;
                }
                // Deleting a rule does not un-categorise what it already did —
                // say so, or the unchanged list reads as a failed delete.
                toast.show(
                  `Pravidlo smazáno. Transakce, které už srovnalo, zůstávají jak jsou.`,
                );
                router.refresh();
              }}
            >
              🗑
            </button>
          </span>
        </li>
      ))}
    </ul>
  );
}
