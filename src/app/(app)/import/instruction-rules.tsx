"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";

interface Suggested {
  kind: string;
  pattern: string;
  target: string;
  explanation: string;
}

const KIND_LABEL: Record<string, string> = {
  "merchant->category": "kategorie",
  "pattern->owner": "kdo",
  "pattern->business": "podnikání",
  "pattern->transfer": "převod",
};

/**
 * Turns the free-text note into rules — proposed, never applied.
 *
 * Each suggestion is a checkbox with the model's own one-sentence restatement
 * next to it. Reading "karta 4141 → Věrka" back in plain Czech is how a
 * misreading gets caught before it silently re-labels a year of transactions.
 */
export function InstructionRules({
  categories,
  users,
}: {
  categories: { id: number; name: string }[];
  users: { id: number; name: string }[];
}) {
  const router = useRouter();
  const toast = useToast();

  const [text, setText] = useState("");
  const [suggestions, setSuggestions] = useState<Suggested[] | null>(null);
  const [chosen, setChosen] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  /** The model answers in names; ids are resolved here or the rule is dropped. */
  function resolveTarget(rule: Suggested): string | null {
    if (rule.kind === "merchant->category") {
      const match = categories.find(
        (category) => category.name.toLowerCase() === rule.target.trim().toLowerCase(),
      );
      return match ? String(match.id) : null;
    }
    if (rule.kind === "pattern->owner") {
      const match = users.find(
        (user) => user.name.toLowerCase() === rule.target.trim().toLowerCase(),
      );
      return match ? String(match.id) : null;
    }
    return rule.target === "1" || rule.target.toLowerCase() === "true" ? "1" : "0";
  }

  async function ask() {
    setBusy(true);
    const result = await postJson<{ rules: Suggested[] }>(
      apiUrl("/api/ai/instructions"),
      { text },
    );
    setBusy(false);

    if (!result.ok) {
      toast.show(result.error ?? "Nepovedlo se.", { tone: "danger" });
      return;
    }

    const found = (result.data?.rules ?? []).filter(
      (rule) => resolveTarget(rule) !== null,
    );
    setSuggestions(found);
    setChosen(new Set(found.map((_, index) => index)));

    if (found.length === 0) {
      toast.show("Z těch pokynů se nedá udělat pravidlo.", { tone: "info" });
    }
  }

  async function save() {
    if (!suggestions) return;
    setBusy(true);

    let stored = 0;
    let moved = 0;

    for (const [index, rule] of suggestions.entries()) {
      if (!chosen.has(index)) continue;
      const target = resolveTarget(rule);
      if (target === null) continue;

      const result = await postJson<{ updated: number }>(apiUrl("/api/rules"), {
        kind: rule.kind,
        pattern: rule.pattern,
        target,
      });
      if (result.ok) {
        stored += 1;
        moved += result.data?.updated ?? 0;
      }
    }

    setBusy(false);
    setSuggestions(null);
    toast.show(
      `Uloženo ${stored} pravidel · srovnala ${moved} transakcí`,
      { tone: "success" },
    );
    router.refresh();
  }

  return (
    <div className="import">
      <label className="crud-field">
        <span className="crud-label">Napiš to vlastními slovy</span>
        <textarea
          rows={3}
          placeholder="Karta 4141 je Věrky. Všechno z Alzy je podnikání. Převody na Revolut jsou převody mezi našimi účty."
          value={text}
          onChange={(event) => setText(event.target.value)}
        />
      </label>

      <div className="crud-form-actions">
        <button
          type="button"
          onClick={() => void ask()}
          disabled={busy || text.trim() === ""}
        >
          {busy ? "Ptám se…" : "Navrhnout pravidla"}
        </button>
      </div>

      {suggestions && suggestions.length > 0 ? (
        <>
          <ul className="crud-list">
            {suggestions.map((rule, index) => (
              <li key={`${rule.kind}-${rule.pattern}`} className="crud-row">
                <span className="crud-main">
                  <span className="crud-title">
                    <input
                      type="checkbox"
                      checked={chosen.has(index)}
                      onChange={(event) =>
                        setChosen((current) => {
                          const next = new Set(current);
                          if (event.target.checked) next.add(index);
                          else next.delete(index);
                          return next;
                        })
                      }
                    />
                    {rule.explanation}
                  </span>
                  <span className="crud-meta">
                    {KIND_LABEL[rule.kind] ?? rule.kind} · vzorek „{rule.pattern}" →{" "}
                    {rule.target}
                  </span>
                </span>
                <span className="crud-actions crud-actions-empty" />
              </li>
            ))}
          </ul>

          <div className="crud-form-actions">
            <button
              type="button"
              className="is-primary"
              onClick={() => void save()}
              disabled={busy || chosen.size === 0}
            >
              Uložit {chosen.size} pravidel
            </button>
            <button type="button" onClick={() => setSuggestions(null)} disabled={busy}>
              Zahodit
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}
