"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";
import { formatCzk } from "@/lib/money";
import { CrudForm } from "./crud-form";
import type { CrudField, CrudItem } from "./types";

/**
 * An editable list: "+ přidat", pencil to edit in place, bin to delete.
 *
 * Deleting is immediate and the toast offers "Vrátit", which re-creates the
 * row from the copy the server sends back. A modal asking "are you sure?"
 * before every removal reads as distrust; an undo after it is both faster and
 * safer, because it also covers the mistakes a confirmation dialog waves
 * through.
 */
export function CrudList({
  endpoint,
  fields,
  items,
  addLabel = "+ přidat",
  emptyNote = "Zatím nic.",
  describe,
}: {
  endpoint: string;
  fields: CrudField[];
  items: CrudItem[];
  addLabel?: string;
  emptyNote?: string;
  /** Word used in toasts, e.g. "Předplatné". */
  describe?: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const noun = describe ?? "Položka";

  async function save(values: Record<string, unknown>, id: number | null) {
    const url = apiUrl(endpoint);
    const result = id
      ? await patch(url, { ...values, id })
      : await postJson<{ ok: true }>(url, values);

    if (!result.ok) {
      toast.show(result.error ?? "Nepovedlo se uložit.", { tone: "danger" });
      return false;
    }

    toast.show(id ? `${noun} upravena.` : `${noun} přidána.`, {
      tone: "success",
    });
    setAdding(false);
    setEditing(null);
    router.refresh();
    return true;
  }

  async function remove(item: CrudItem) {
    setBusy(item.id);
    const result = await deleteJson(apiUrl(`${endpoint}?id=${item.id}`));
    setBusy(null);

    if (!result.ok) {
      toast.show(result.error ?? "Nepovedlo se smazat.", { tone: "danger" });
      return;
    }

    toast.show(`${noun} „${item.title}" smazána.`, {
      undo: async () => {
        const restore = { ...item.values };
        const back = await postJson(apiUrl(endpoint), restore);
        if (!back.ok) {
          toast.show(back.error ?? "Vrácení se nepovedlo.", { tone: "danger" });
        }
        router.refresh();
      },
    });
    router.refresh();
  }

  return (
    <div className="crud">
      {items.length === 0 && !adding ? (
        <p className="empty-note">{emptyNote}</p>
      ) : null}

      <ul className="crud-list">
        {items.map((item) =>
          editing === item.id ? (
            <li key={item.id} className="crud-row is-editing">
              <CrudForm
                fields={fields}
                initial={item.values}
                submitLabel="Uložit"
                onCancel={() => setEditing(null)}
                onSubmit={(values) => save(values, item.id)}
              />
            </li>
          ) : (
            <li
              key={item.id}
              className={`crud-row${item.muted ? " is-muted" : ""}${
                busy === item.id ? " is-busy" : ""
              }`}
            >
              <span className="crud-main">
                <span className="crud-title">
                  {item.title}
                  {item.flags?.map((flag) => (
                    <span key={flag} className="tx-chip is-flag">
                      {flag}
                    </span>
                  ))}
                </span>
                {item.meta ? (
                  <span className="crud-meta">{item.meta}</span>
                ) : null}
              </span>

              {item.amount !== null && item.amount !== undefined ? (
                <span className="numo-numeric crud-amount">
                  {formatCzk(item.amount)}
                </span>
              ) : null}

              {item.muted ? (
                <span className="crud-actions crud-actions-empty" />
              ) : (
                <span className="crud-actions">
                  <button
                    type="button"
                    aria-label={`Upravit ${item.title}`}
                    title="Upravit"
                    onClick={() => {
                      setAdding(false);
                      setEditing(item.id);
                    }}
                  >
                    ✎
                  </button>
                  <button
                    type="button"
                    aria-label={`Smazat ${item.title}`}
                    title="Smazat"
                    className="is-danger"
                    disabled={busy === item.id}
                    onClick={() => void remove(item)}
                  >
                    🗑
                  </button>
                </span>
              )}
            </li>
          ),
        )}
      </ul>

      {adding ? (
        <div className="crud-row is-editing">
          <CrudForm
            fields={fields}
            initial={{}}
            submitLabel="Přidat"
            onCancel={() => setAdding(false)}
            onSubmit={(values) => save(values, null)}
          />
        </div>
      ) : (
        <button
          type="button"
          className="crud-add"
          onClick={() => {
            setEditing(null);
            setAdding(true);
          }}
        >
          {addLabel}
        </button>
      )}
    </div>
  );
}

async function patch(url: string, body: unknown) {
  return sendJson(url, "PATCH", body);
}

async function deleteJson(url: string) {
  return sendJson(url, "DELETE", undefined);
}

async function sendJson(url: string, method: string, body: unknown) {
  try {
    const response = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await response.text();
    const data = text ? (JSON.parse(text) as { error?: string }) : null;
    return {
      ok: response.ok,
      error: response.ok ? null : (data?.error ?? `HTTP ${response.status}`),
    };
  } catch {
    return { ok: false, error: "Server neodpověděl. Zkontroluj připojení." };
  }
}
