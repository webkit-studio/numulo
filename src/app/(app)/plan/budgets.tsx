"use client";

import { useState, useTransition } from "react";
import { setCategoryLimit } from "@/app/actions/plan";
import { Money } from "@/components/money";
import { useToast } from "@/components/toast";
import { halereToCzk } from "@/lib/money";
import type { CategorySpend } from "@/lib/data/month";

/**
 * Budgets: the same envelope, with the limit editable in place.
 *
 * Přehled shows these read-only and points here; this is where a limit is set,
 * changed, or taken away again. One column, not two — a category and its
 * ceiling belong on one line, and the eye should be able to run down the
 * "zbývá" figures without hopping between columns.
 */
export function Budgets({ categories }: { categories: CategorySpend[] }) {
  return (
    <ul className="envelopes envelopes-single">
      {categories.map((category) => (
        <BudgetRow key={category.id} category={category} />
      ))}
    </ul>
  );
}

const stateClass = (state: string) =>
  state === "v klidu" ? "calm" : state === "dochází" ? "low" : "over";

function BudgetRow({ category }: { category: CategorySpend }) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(
    category.monthlyLimit === null ? "" : String(halereToCzk(category.monthlyLimit)),
  );
  const [saving, startSaving] = useTransition();
  const { envelope } = category;

  function save(next: string | null) {
    startSaving(async () => {
      const result = await setCategoryLimit(category.id, category.name, next);
      toast.show(result.notice ?? result.error ?? "Hotovo", result.error ? "danger" : "success");
      if (!result.error) setEditing(false);
    });
  }

  return (
    <li className="envelope">
      <div className="envelope-head">
        <span className="envelope-name">
          <span className="dot" style={{ background: category.color }} aria-hidden="true" />
          {category.name}
          {envelope.state ? (
            <span className={`envelope-state state-${stateClass(envelope.state)}`}>
              {envelope.state}
            </span>
          ) : null}
        </span>

        {editing ? (
          <span className="limit-edit">
            <span className="field-box">
              <input
                className="input"
                type="number"
                min="0"
                inputMode="numeric"
                autoFocus
                value={value}
                onChange={(event) => setValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") save(value);
                  if (event.key === "Escape") setEditing(false);
                }}
                aria-label={`Limit pro ${category.name}`}
              />
              <span className="field-unit">Kč</span>
            </span>
            <button type="button" className="btn btn-small" disabled={saving} onClick={() => save(value)}>
              uložit
            </button>
            <button type="button" className="btn-quiet" onClick={() => setEditing(false)}>zrušit</button>
            {category.monthlyLimit !== null ? (
              <button type="button" className="btn-quiet" disabled={saving} onClick={() => save(null)}>
                zrušit limit
              </button>
            ) : null}
          </span>
        ) : envelope.limit === null ? (
          <button type="button" className="envelope-action" onClick={() => setEditing(true)}>
            nastavit limit ›
          </button>
        ) : (
          <span className="envelope-remaining">
            zbývá <Money value={envelope.remaining ?? 0} />{" "}
            <button
              type="button"
              className="icon-btn"
              title="Upravit limit"
              aria-label={`Upravit limit pro ${category.name}`}
              onClick={() => setEditing(true)}
            >
              ✎
            </button>
          </span>
        )}
      </div>

      {envelope.limit === null ? (
        <p className="envelope-note">
          utraceno <Money value={category.spent} tone="plain" />
        </p>
      ) : (
        <>
          <div className="bar">
            <span className="bar-fill" style={{ width: `${envelope.fillPercent}%` }} />
            {envelope.overPercent > 0 ? (
              <span className="bar-over" style={{ width: `${envelope.overPercent}%` }} />
            ) : null}
          </div>
          <p className="envelope-note">
            utraceno <Money value={category.spent} tone="plain" /> z limitu{" "}
            <Money value={envelope.limit} tone="plain" />
            {envelope.remaining !== null && envelope.remaining < 0 ? " · kryto z rezervy" : ""}
          </p>
        </>
      )}
    </li>
  );
}
