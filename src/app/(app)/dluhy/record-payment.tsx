"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";
import { halereToCzk } from "@/lib/money";

/**
 * "Zaznamenat splátku" — the ordinary instalment is pre-filled, because that is
 * what gets recorded nine times out of ten.
 */
export function RecordPayment({
  debtId,
  creditor,
  installment,
  today,
}: {
  debtId: number;
  creditor: string;
  installment: number;
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(String(halereToCzk(installment)));
  const [date, setDate] = useState(today);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button type="button" className="crud-add" onClick={() => setOpen(true)}>
        + zaznamenat splátku
      </button>
    );
  }

  return (
    <form
      className="crud-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);

        const result = await postJson<{ remaining: number; cleared: boolean }>(
          apiUrl("/api/debts/payments"),
          { debtId, amount, date, note },
        );
        setSaving(false);

        if (!result.ok) {
          toast.show(result.error ?? "Nepovedlo se to.", { tone: "danger" });
          return;
        }

        toast.show(
          result.data?.cleared
            ? `${creditor} je splacený. Hotovo.`
            : `Splátka zapsaná — zbývá ${new Intl.NumberFormat("cs-CZ", {
                maximumFractionDigits: 0,
              }).format(halereToCzk(result.data?.remaining ?? 0))} Kč.`,
          { tone: "success" },
        );
        setOpen(false);
        setNote("");
        router.refresh();
      }}
    >
      <div className="crud-fields">
        <label className="crud-field is-half">
          <span className="crud-label">Kolik (Kč)</span>
          <input
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>
        <label className="crud-field is-half">
          <span className="crud-label">Kdy</span>
          <input
            type="date"
            required
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label className="crud-field">
          <span className="crud-label">Poznámka</span>
          <input
            type="text"
            placeholder="mimořádná splátka, …"
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </label>
      </div>

      <div className="crud-form-actions">
        <button type="submit" className="is-primary" disabled={saving}>
          {saving ? "Zapisuji…" : "Zapsat splátku"}
        </button>
        <button type="button" onClick={() => setOpen(false)} disabled={saving}>
          Zrušit
        </button>
      </div>
    </form>
  );
}
