import type { Metadata } from "next";
import { getAccount } from "@/lib/data/queries";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "numo — nastavení" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const account = await getAccount();

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Nastavení</h1>
          <p className="page-sub">Účet {account.name}</p>
        </div>
      </header>

      <section className="card">
        <header className="card-head">
          <h2>Rozpočet a počáteční stav</h2>
        </header>
        <p className="card-lede">
          Dokud počáteční stav nezadáš, Rezerva nemá z čeho počítat a na
          Přehledu se místo čísla ukazuje výzva.
        </p>
        <SettingsForm
          monthlyBudget={account.monthlyBudget}
          initialBalance={account.initialBalance}
          initialBalanceDate={account.initialBalanceDate}
        />
      </section>
    </>
  );
}
