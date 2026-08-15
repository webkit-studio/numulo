"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";

/**
 * The one-handed entry form.
 *
 * The amount field is autofocused and everything else has a working default,
 * so the shortest path is: type a number, type a shop, done. Anything that
 * demands more taps than the paper receipt does will simply not get used.
 */
export function ExpenseForm({
  categories,
  users,
  today,
}: {
  categories: { id: number; name: string }[];
  users: { id: number; name: string }[];
  today: string;
}) {
  const router = useRouter();
  const toast = useToast();

  const [amount, setAmount] = useState("");
  const [merchant, setMerchant] = useState("");
  const [date, setDate] = useState(today);
  const [categoryId, setCategoryId] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [direction, setDirection] = useState<"expense" | "income">("expense");
  const [saving, setSaving] = useState(false);

  return (
    <form
      className="stack-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);

        const result = await postJson(apiUrl("/api/transactions"), {
          amount,
          merchant,
          date,
          direction,
          categoryId: categoryId === "" ? null : Number(categoryId),
          ownerId: ownerId === "" ? null : Number(ownerId),
        });
        setSaving(false);

        if (!result.ok) {
          toast.show(result.error ?? "Nepovedlo se zapsat.", { tone: "danger" });
          return;
        }

        toast.show(
          `${direction === "income" ? "Příjem" : "Výdaj"} zapsán: ${merchant}`,
          { tone: "success" },
        );
        // Keep the date and who — the next entry is usually from the same
        // trip. Clear what changes.
        setAmount("");
        setMerchant("");
        setCategoryId("");
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
            autoFocus
            placeholder="0"
            className="big-amount numo-numeric"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </label>

        <label className="crud-field is-half">
          <span className="crud-label">Za co</span>
          <input
            type="text"
            required
            placeholder="Kafe, tržnice, …"
            value={merchant}
            onChange={(event) => setMerchant(event.target.value)}
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

        <label className="crud-field is-half">
          <span className="crud-label">Kategorie</span>
          <select
            value={categoryId}
            onChange={(event) => setCategoryId(event.target.value)}
          >
            <option value="">bez kategorie</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="crud-field is-half">
          <span className="crud-label">Kdo</span>
          <select
            value={ownerId}
            onChange={(event) => setOwnerId(event.target.value)}
          >
            <option value="">nikdo konkrétní</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name}
              </option>
            ))}
          </select>
        </label>

        <label className="crud-field is-half">
          <span className="crud-label">Typ</span>
          <select
            value={direction}
            onChange={(event) =>
              setDirection(event.target.value as "expense" | "income")
            }
          >
            <option value="expense">výdaj</option>
            <option value="income">příjem</option>
          </select>
        </label>
      </div>

      <div className="crud-form-actions">
        <button type="submit" className="is-primary" disabled={saving}>
          {saving ? "Zapisuji…" : "Zapsat"}
        </button>
      </div>
    </form>
  );
}
