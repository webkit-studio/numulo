"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import { addListItem, removeListItem, updateListItem, type ListResult } from "@/app/actions/lists";
import { SubmitButton } from "@/components/submit-button";
import { useToast } from "@/components/toast";
import { LISTS, type FieldSpec, type ListKey } from "@/lib/lists/registry";
import { halereToCzk } from "@/lib/money";

/**
 * The editable list, once.
 *
 * The caller says what a row looks like when it is being read; this component
 * owns everything about changing it — the pencil that swaps the row for
 * inputs, the bin, the quiet "+ přidat" row at the end, and the toast that
 * confirms each one. Rows are server-rendered and the actions revalidate, so
 * after a change the numbers everywhere else on the page are the new ones.
 */

export interface CrudRow {
  id: string;
  /** Raw column values, so the inline form opens with what is stored. */
  values: Record<string, unknown>;
  /** How the row reads when nobody is editing it. */
  view: ReactNode;
  /** Actions that belong to this row alone — the ⊘ on a subscription. */
  before?: ReactNode;
}

const emptyResult: ListResult = { error: null };

/** Inputs open with the stored value, in the units a person types. */
function initialValue(field: FieldSpec, stored: unknown): string {
  if (stored === null || stored === undefined) return "";
  if (field.kind === "money") return String(halereToCzk(Number(stored)));
  return String(stored);
}

function Field({ field, value }: { field: FieldSpec; value: string }) {
  if (field.kind === "choice") {
    return (
      <label className="field field-choice" style={{ flexGrow: field.grow ?? 1 }}>
        <span className="field-label">{field.label}</span>
        <select name={field.key} defaultValue={value || field.options?.[0]?.value} className="input">
          {field.options?.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
    );
  }

  const numeric = field.kind !== "text" && field.kind !== "month";

  return (
    <label className={`field${field.kind === "money" ? " field-money" : ""}`} style={{ flexGrow: field.grow ?? 1 }}>
      <span className="field-label">{field.label}</span>
      <span className="field-box">
        <input
          className="input"
          name={field.key}
          type={field.kind === "month" ? "month" : numeric ? "number" : "text"}
          inputMode={numeric ? "numeric" : undefined}
          defaultValue={value}
          placeholder={field.hint}
          required={!field.optional}
          min={field.kind === "day" ? 1 : field.kind === "monthNumber" ? 1 : undefined}
          max={field.kind === "day" ? 31 : field.kind === "monthNumber" ? 12 : undefined}
        />
        {/* The unit sits outside the box, so the boxes still line up. */}
        {field.kind === "money" ? <span className="field-unit">Kč</span> : null}
      </span>
    </label>
  );
}

function Fields({ listKey, values }: { listKey: ListKey; values: Record<string, unknown> }) {
  return (
    <div className="field-row">
      {LISTS[listKey].fields.map((field) => (
        <Field key={field.key} field={field} value={initialValue(field, values[field.key])} />
      ))}
    </div>
  );
}

/** Reports the action's own words, whichever way it went. */
function useResultToast(result: ListResult, onSuccess?: () => void) {
  const toast = useToast();
  useEffect(() => {
    if (result.notice) {
      toast.show(result.notice);
      onSuccess?.();
    } else if (result.error) {
      toast.show(result.error, "danger");
    }
    // The result object identity is what changes per submission.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);
}

function EditRow({
  listKey,
  row,
  onDone,
}: {
  listKey: ListKey;
  row: CrudRow;
  onDone: () => void;
}) {
  const [state, action] = useActionState(updateListItem, emptyResult);
  useResultToast(state, onDone);

  return (
    <li className="crud-row is-editing">
      <form action={action} className="crud-form">
        <input type="hidden" name="list" value={listKey} />
        <input type="hidden" name="id" value={row.id} />
        <Fields listKey={listKey} values={row.values} />
        <div className="crud-form-actions">
          <SubmitButton className="btn btn-small">Uložit</SubmitButton>
          <button type="button" className="btn-quiet" onClick={onDone}>zrušit</button>
        </div>
      </form>
    </li>
  );
}

function AddRow({ listKey, householdId }: { listKey: ListKey; householdId: string }) {
  const [open, setOpen] = useState(false);
  const [state, action] = useActionState(addListItem, emptyResult);
  useResultToast(state, () => setOpen(false));

  if (!open) {
    return (
      <li className="crud-add">
        <button type="button" className="btn-quiet" onClick={() => setOpen(true)}>
          {LISTS[listKey].addLabel}
        </button>
      </li>
    );
  }

  return (
    <li className="crud-row is-editing">
      <form action={action} className="crud-form">
        <input type="hidden" name="list" value={listKey} />
        <input type="hidden" name="householdId" value={householdId} />
        <Fields listKey={listKey} values={{}} />
        <div className="crud-form-actions">
          <SubmitButton className="btn btn-small">Přidat</SubmitButton>
          <button type="button" className="btn-quiet" onClick={() => setOpen(false)}>zrušit</button>
        </div>
      </form>
    </li>
  );
}

export function CrudList({
  listKey,
  householdId,
  rows,
  empty,
}: {
  listKey: ListKey;
  householdId: string;
  rows: CrudRow[];
  empty?: ReactNode;
}) {
  const toast = useToast();
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);

  async function remove(row: CrudRow) {
    const name = String(row.values[LISTS[listKey].titleField] ?? "");
    setRemoving(row.id);
    const result = await removeListItem(listKey, row.id, name);
    setRemoving(null);
    toast.show(result.notice ?? result.error ?? "Hotovo", result.error ? "danger" : "success");
  }

  return (
    <ul className="crud">
      {rows.length === 0 && empty ? <li className="crud-empty">{empty}</li> : null}

      {rows.map((row) =>
        editing === row.id ? (
          <EditRow key={row.id} listKey={listKey} row={row} onDone={() => setEditing(null)} />
        ) : (
          <li key={row.id} className={`crud-row${removing === row.id ? " is-busy" : ""}`}>
            <div className="crud-view">{row.view}</div>
            <div className="crud-actions">
              {row.before}
              <button
                type="button"
                className="icon-btn"
                title="Upravit"
                aria-label={`Upravit ${row.values[LISTS[listKey].titleField]}`}
                onClick={() => setEditing(row.id)}
              >
                ✎
              </button>
              <button
                type="button"
                className="icon-btn"
                title="Smazat"
                aria-label={`Smazat ${row.values[LISTS[listKey].titleField]}`}
                disabled={removing === row.id}
                onClick={() => void remove(row)}
              >
                🗑
              </button>
            </div>
          </li>
        ),
      )}

      <AddRow listKey={listKey} householdId={householdId} />
    </ul>
  );
}
