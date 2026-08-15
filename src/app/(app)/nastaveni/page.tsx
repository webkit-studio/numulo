import type { Metadata } from "next";
import { getAccount, getCategories, getUsers } from "@/lib/data/queries";
import { getDb } from "@/db/getDb";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { listRules } from "@/lib/rules/engine";
import { getCurrentUser } from "@/lib/auth/current-user";
import { emailConfigured } from "@/lib/email/send";
import { users as usersTable } from "@/db/schema";
import { AccountSecurity } from "./account-security";
import { RulesList, type RuleRow } from "./rules-list";
import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "numo — nastavení" };
export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  "merchant->category": "obchodník → kategorie",
  "pattern->owner": "vzorek → kdo",
  "pattern->business": "vzorek → podnikání",
  "pattern->transfer": "vzorek → převod",
};

export default async function SettingsPage() {
  const [account, rules, categories, users, me, members] = await Promise.all([
    getAccount(),
    listRules(getDb(), ACCOUNT_ID),
    getCategories(),
    getUsers(),
    getCurrentUser(),
    getDb()
      .select({
        id: usersTable.id,
        name: usersTable.name,
        email: usersTable.email,
        passwordSetAt: usersTable.passwordSetAt,
      })
      .from(usersTable),
  ]);

  const categoryName = new Map(categories.map((c) => [String(c.id), c.name]));
  const userName = new Map(users.map((u) => [String(u.id), u.name]));

  const rows: RuleRow[] = rules.map((rule) => ({
    id: rule.id,
    kindLabel: KIND_LABEL[rule.kind] ?? rule.kind,
    pattern: rule.pattern,
    targetLabel:
      rule.kind === "merchant->category"
        ? (categoryName.get(rule.target) ?? `kategorie ${rule.target}`)
        : rule.kind === "pattern->owner"
          ? (userName.get(rule.target) ?? `uživatel ${rule.target}`)
          : rule.target === "0"
            ? "ne"
            : "ano",
    createdFrom: rule.createdFrom ?? "ručně",
  }));

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

      {me ? (
        <section className="card">
          <header className="card-head">
            <h2>Heslo a přístup</h2>
            <p className="card-sub">
              Přihlášený jako {me.name}. Změna hesla odhlásí ostatní zařízení.
            </p>
          </header>
          <AccountSecurity
            me={{ id: me.id, name: me.name }}
            emailConfigured={emailConfigured()}
            members={members.map((member) => ({
              id: member.id,
              name: member.name,
              email: member.email,
              hasPassword: member.passwordSetAt !== null,
            }))}
          />
        </section>
      ) : null}

      <section className="card">
        <header className="card-head">
          <h2>Naučená pravidla</h2>
          <p className="card-sub">
            {rows.length} pravidel. Použijí se na každý další import — proto tu
            jsou vidět a jdou smazat.
          </p>
        </header>
        <RulesList rules={rows} />
      </section>
    </>
  );
}
