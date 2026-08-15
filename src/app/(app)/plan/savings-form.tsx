"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";
import { formatCzk, halereToCzk } from "@/lib/money";

/**
 * Spoření — either a fixed monthly amount or a share of what came in.
 *
 * The live preview under the field turns the percentage into crowns, because
 * "12 %" of an income that changes every month is not a number anyone can
 * picture on its own.
 */
export function SavingsForm({
  mode: initialMode,
  value: initialValue,
  received,
}: {
  mode: "amount" | "percent";
  value: number;
  received: number;
}) {
  const router = useRouter();
  const toast = useToast();
  const [mode, setMode] = useState(initialMode);
  const [value, setValue] = useState(
    String(initialMode === "amount" ? halereToCzk(initialValue) : initialValue),
  );
  const [saving, setSaving] = useState(false);

  const parsed = Number(value.replace(",", "."));
  const preview =
    !Number.isFinite(parsed) || parsed <= 0
      ? null
      : mode === "amount"
        ? null
        : formatCzk(Math.round((received * parsed) / 100));

  return (
    <form
      className="stack-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        const result = await postJson(apiUrl("/api/settings/savings"), {
          savingsMode: mode,
          savingsValue: value,
        });
        setSaving(false);

        if (!result.ok) {
          toast.show(result.error ?? "Nepovedlo se uložit.", { tone: "danger" });
          return;
        }
        toast.show("Spoření uloženo.", { tone: "success" });
        router.refresh();
      }}
    >
      <div className="crud-fields">
        <label className="crud-field is-half">
          <span className="crud-label">Jak spoříme</span>
          <select
            value={mode}
            onChange={(event) =>
              setMode(event.target.value as "amount" | "percent")
            }
          >
            <option value="amount">pevnou částkou</option>
            <option value="percent">procentem z příjmu</option>
          </select>
        </label>

        <label className="crud-field is-half">
          <span className="crud-label">
            {mode === "amount" ? "Kolik měsíčně (Kč)" : "Kolik procent"}
          </span>
          <input
            type="number"
            step={mode === "amount" ? "1" : "0.5"}
            min="0"
            max={mode === "percent" ? 100 : undefined}
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
          {preview ? (
            <span className="crud-hint">
              z letošního příjmu {formatCzk(received)} to je {preview}
            </span>
          ) : null}
        </label>
      </div>

      <div className="crud-form-actions">
        <button type="submit" className="is-primary" disabled={saving}>
          {saving ? "Ukládám…" : "Uložit spoření"}
        </button>
      </div>
    </form>
  );
}
