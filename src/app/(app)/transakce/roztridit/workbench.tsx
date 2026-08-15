"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";
import type { MerchantGroup } from "@/lib/data/queries";
import { formatCzk } from "@/lib/money";

interface Category {
  id: number;
  name: string;
  color: string;
}

/**
 * Sorting by merchant instead of by transaction.
 *
 * One choice writes a rule and moves every matching row at once, so a hundred
 * unsorted payments become a dozen decisions — and the list is ordered by
 * money, so the decisions that matter come first.
 */
export function SortWorkbench({
  merchants,
  categories,
  aiAvailable,
}: {
  merchants: MerchantGroup[];
  categories: Category[];
  aiAvailable: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const [done, setDone] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<Record<string, number>>({});
  const [suggesting, setSuggesting] = useState(false);

  async function assign(group: MerchantGroup, categoryId: number) {
    setBusy(group.merchant);
    const category = categories.find((c) => c.id === categoryId);

    const result = await postJson<{ updated: number }>(apiUrl("/api/rules"), {
      kind: "merchant->category",
      pattern: group.merchant,
      target: String(categoryId),
    });

    if (!result.ok) toast.show(result.error ?? "Nepovedlo se to.", { tone: "danger" });
    else {
      setDone((current) => ({ ...current, [group.merchant]: category?.name ?? "" }));
      toast.show(
        `${category?.name}: srovnáno ${result.data?.updated ?? 0} transakcí`,
        { tone: "success" },
      );
      router.refresh();
    }
    setBusy(null);
  }

  async function askAi() {
    setSuggesting(true);
    const pending = merchants.filter((group) => !done[group.merchant]);

    const result = await postJson<{
      suggestions: { merchant: string; categoryId: number }[];
    }>(apiUrl("/api/ai/categorise"), {
      merchants: pending.map((group) => group.merchant),
    });

    if (!result.ok) {
      toast.show(result.error ?? "Návrhy se nepovedly.", { tone: "danger" });
    } else {
      const next: Record<string, number> = {};
      for (const item of result.data?.suggestions ?? []) {
        next[item.merchant] = item.categoryId;
      }
      setSuggestions(next);
      toast.show(
        `Návrhy pro ${Object.keys(next).length} obchodníků — projdi je a potvrď.`,
      );
    }
    setSuggesting(false);
  }

  if (merchants.length === 0) {
    return (
      <section className="card">
        <p className="empty-note">
          Nic k třídění — všechny útraty mají kategorii.
        </p>
      </section>
    );
  }

  return (
    <section className="card">
      {aiAvailable ? (
        <div className="sort-ai">
          <button type="button" onClick={askAi} disabled={suggesting}>
            {suggesting ? "Ptám se…" : "Navrhnout kategorie přes AI"}
          </button>
          <span className="seed-hint">
            AI jen navrhne. Uloží se až to, co potvrdíš.
          </span>
        </div>
      ) : null}

      <ul className="sort-list">
        {merchants.map((group) => {
          const settled = done[group.merchant];
          const suggested = suggestions[group.merchant];

          return (
            <li
              key={group.merchant}
              className={`sort-row${settled ? " is-done" : ""}`}
            >
              <span className="sort-main">
                <span className="sort-merchant">{group.merchant}</span>
                <span className="tx-meta">
                  {group.count}× · {formatCzk(group.total)} ·{" "}
                  {group.firstDate.slice(0, 7)} – {group.lastDate.slice(0, 7)}
                </span>
              </span>

              {settled ? (
                <span className="sort-settled">→ {settled}</span>
              ) : (
                <span className="sort-actions">
                  {suggested ? (
                    <button
                      type="button"
                      className="chip is-suggested"
                      onClick={() => void assign(group, suggested)}
                      disabled={busy === group.merchant}
                    >
                      ✓ {categories.find((c) => c.id === suggested)?.name}
                    </button>
                  ) : null}

                  <select
                    defaultValue=""
                    disabled={busy === group.merchant}
                    onChange={(event) => {
                      const value = Number(event.target.value);
                      if (Number.isInteger(value) && value > 0) {
                        void assign(group, value);
                      }
                    }}
                    aria-label={`Kategorie pro ${group.merchant}`}
                  >
                    <option value="">zvolit kategorii…</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
