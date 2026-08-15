"use client";

import { useState } from "react";
import type { CrudField } from "./types";

/** The add/edit form. Shared so a new row and an edited row can't drift apart. */
export function CrudForm({
  fields,
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  fields: CrudField[];
  initial: Record<string, string | number | boolean | null>;
  submitLabel: string;
  onSubmit: (values: Record<string, unknown>) => Promise<boolean>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState<Record<string, unknown>>(() => {
    const start: Record<string, unknown> = {};
    for (const field of fields) {
      const given = initial[field.name];
      start[field.name] =
        given ?? (field.type === "bool" ? false : field.type === "enum" ? (field.options?.[0]?.value ?? "") : "");
    }
    return start;
  });
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="crud-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        await onSubmit(values);
        setSaving(false);
      }}
    >
      <div className="crud-fields">
        {fields.map((field) => (
          <label
            key={field.name}
            className={`crud-field${field.half ? " is-half" : ""}${
              field.type === "bool" ? " is-check" : ""
            }`}
          >
            <span className="crud-label">{field.label}</span>

            {field.type === "enum" ? (
              <select
                value={String(values[field.name] ?? "")}
                required={field.required}
                onChange={(event) =>
                  setValues((v) => ({ ...v, [field.name]: event.target.value }))
                }
              >
                {field.options?.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            ) : field.type === "bool" ? (
              <input
                type="checkbox"
                checked={Boolean(values[field.name])}
                onChange={(event) =>
                  setValues((v) => ({ ...v, [field.name]: event.target.checked }))
                }
              />
            ) : (
              <input
                type={inputType(field.type)}
                inputMode={
                  field.type === "money" || field.type === "int"
                    ? "decimal"
                    : undefined
                }
                step={field.type === "money" ? "0.01" : field.type === "int" ? "1" : undefined}
                placeholder={field.placeholder}
                required={field.required}
                value={String(values[field.name] ?? "")}
                onChange={(event) =>
                  setValues((v) => ({ ...v, [field.name]: event.target.value }))
                }
              />
            )}

            {field.hint ? <span className="crud-hint">{field.hint}</span> : null}
          </label>
        ))}
      </div>

      <div className="crud-form-actions">
        <button type="submit" className="is-primary" disabled={saving}>
          {saving ? "Ukládám…" : submitLabel}
        </button>
        <button type="button" onClick={onCancel} disabled={saving}>
          Zrušit
        </button>
      </div>
    </form>
  );
}

function inputType(type: CrudField["type"]): string {
  if (type === "money" || type === "int") return "number";
  if (type === "date") return "date";
  if (type === "month") return "month";
  return "text";
}
