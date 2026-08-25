import type { Metadata } from "next";
import { getMembers, getSession } from "@/lib/data/household";
import { SettingsForm } from "./settings-form";
import { JoinCode } from "./join-code";
import { ChangePassword } from "./change-password";
import { halereToCzk } from "@/lib/money";

export const metadata: Metadata = { title: "Numulo — nastavení účtu" };
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const { household, viewer } = await getSession();
  if (!household || !viewer) return null;

  const members = await getMembers(household.id);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Nastavení účtu</h1>
          <p className="page-sub">{household.name}</p>
        </div>
      </header>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Účet</h2>
          <p className="card-sub">
            Rozpočet je strop útrat domácnosti — kolik za měsíc smí odejít, ne kolik přijde.
            Počáteční stav říká Rezervě, odkud začít počítat.
          </p>
        </div>
        <SettingsForm
          householdId={household.id}
          name={household.name}
          monthlyBudget={halereToCzk(household.monthly_budget)}
          initialBalance={halereToCzk(household.initial_balance)}
          initialBalanceDate={household.initial_balance_date}
          kind={household.kind}
        />
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Sdílení</h2>
          <p className="card-sub">
            Kdo má tenhle kód, dostane se k financím domácnosti. Předej ho jen tomu,
            komu důvěřuješ — a když se rozšíří, vyrob nový.
          </p>
        </div>
        <JoinCode householdId={household.id} code={household.join_code} />

        <ul className="member-list">
          {members.map((member) => (
            <li key={member.userId} className="member">
              <span className="avatar" aria-hidden="true">
                {member.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="member-name">
                {member.name}
                {member.userId === viewer.id ? <span className="member-you"> (ty)</span> : null}
              </span>
              <span className="member-role">
                {member.role === "owner" ? "vlastník" : "člen"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Přihlášení</h2>
          <p className="card-sub">
            Heslo se dá změnit tady, bez e-mailu. Odkaz na obnovu je pro toho,
            kdo se dovnitř nedostane vůbec.
          </p>
        </div>
        <ChangePassword email={viewer.email} />
      </section>
    </>
  );
}
