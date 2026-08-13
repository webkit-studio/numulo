"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";
import { halereToCzk } from "@/lib/money";

export function SettingsForm({
  monthlyBudget,
  initialBalance,
  initialBalanceDate,
}: {
  monthlyBudget: number;
  initialBalance: number;
  initialBalanceDate: string | null;
}) {
  const router = useRouter();
  const [budget, setBudget] = useState(String(halereToCzk(monthlyBudget)));
  const [balance, setBalance] = useState(String(halereToCzk(initialBalance)));
  const [date, setDate] = useState(initialBalanceDate ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);

    const result = await postJson(apiUrl("/api/settings/account"), {
      monthlyBudget: budget,
      initialBalance: balance,
      initialBalanceDate: date,
    });

    if (!result.ok) setError(result.error);
    else {
      setSaved(true);
      router.refresh();
    }
    setPending(false);
  }

  return (
    <form onSubmit={onSubmit} className="settings-form">
      <label htmlFor="budget">Měsíční rozpočet (Kč)</label>
      <input
        id="budget"
        inputMode="decimal"
        value={budget}
        onChange={(event) => setBudget(event.target.value)}
      />
      <p className="seed-hint">
        Strop útrat domácnosti. Není to výplata ani převod peněz.
      </p>

      <label htmlFor="balance">Počáteční stav — hotovost (Kč)</label>
      <input
        id="balance"
        inputMode="decimal"
        value={balance}
        onChange={(event) => setBalance(event.target.value)}
      />
      <p className="seed-hint">
        Kolik máte celkem na sledovaných účtech k datu níž.{" "}
        <strong>Bez dluhů</strong> — ty se odečtou samy z jejich vlastní
        evidence. Může být i záporné.
      </p>

      <label htmlFor="date">…k datu</label>
      <input
        id="date"
        type="date"
        value={date}
        onChange={(event) => setDate(event.target.value)}
      />
      <p className="seed-hint">
        Hranice historie. Transakce s dřívějším datem sytí průměry a Vývoj, ale
        Rezervu nemění. Seed import ji nastavil na poslední den v master CSV.
      </p>

      {error ? (
        <p role="alert" className="login-error">
          {error}
        </p>
      ) : null}
      {saved ? <p className="settings-saved">Uloženo.</p> : null}

      <button type="submit" disabled={pending}>
        {pending ? "Ukládám…" : "Uložit"}
      </button>
    </form>
  );
}
