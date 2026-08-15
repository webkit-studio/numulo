import type { Metadata } from "next";
import { CrudList } from "@/components/crud/crud-list";
import type { CrudItem } from "@/components/crud/types";
import { MonthLabel } from "@/components/money";
import { MonthPicker } from "@/components/month-picker";
import {
  getDebts,
  getPaidThisMonth,
  getRecurringMonthly,
  getRecurringYearly,
  getSubscriptions,
} from "@/lib/data/plan";
import { getDefaultMonth, getMonthsWithData } from "@/lib/data/queries";
import { formatCzk, halereToCzk } from "@/lib/money";
import { CancelSimulator } from "./cancel-sim";
import { DetectedSubscriptions } from "./detected";
import { PaidToggle } from "./paid-toggle";

export const metadata: Metadata = { title: "numo — pravidelné" };
export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "lednu", "únoru", "březnu", "dubnu", "květnu", "červnu",
  "červenci", "srpnu", "září", "říjnu", "listopadu", "prosinci",
];

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

  const months = await getMonthsWithData();
  const requested = typeof params.mesic === "string" ? params.mesic : null;
  const month =
    requested && months.includes(requested)
      ? requested
      : await getDefaultMonth(today);

  const [subs, monthly, yearly, debtRows, paid] = await Promise.all([
    getSubscriptions(),
    getRecurringMonthly(),
    getRecurringYearly(),
    getDebts(),
    getPaidThisMonth(month),
  ]);

  const monthNumber = Number(month.slice(5, 7));

  const perMonth =
    subs.reduce((sum, item) => (item.active ? sum + item.amount : sum), 0) +
    monthly.reduce((sum, item) => (item.active ? sum + item.amount : sum), 0);

  const perYear =
    perMonth * 12 +
    yearly.reduce((sum, item) => (item.active ? sum + item.amount : sum), 0);

  const outstanding =
    subs.filter((s) => s.active && !paid.has(`subscription:${s.id}`)).length +
    monthly.filter((m) => m.active && !paid.has(`monthly:${m.id}`)).length +
    yearly.filter(
      (y) => y.active && y.dueMonth === monthNumber && !paid.has(`yearly:${y.id}`),
    ).length;

  const subItems: CrudItem[] = subs.map((item) => ({
    id: item.id,
    title: item.name,
    meta: [
      item.day ? `strhává se ${item.day}.` : "bez pevného dne",
      item.active ? null : "zrušené",
      item.status === "detected" ? "návrh" : null,
    ]
      .filter(Boolean)
      .join(" · "),
    amount: item.amount,
    muted: !item.active,
    values: {
      name: item.name,
      amount: halereToCzk(item.amount),
      day: item.day ?? "",
      active: item.active,
    },
  }));

  const monthlyItems: CrudItem[] = monthly.map((item) => ({
    id: item.id,
    title: item.name,
    meta: [item.day ? `splatnost ${item.day}.` : "bez pevného dne", item.active ? null : "vypnuté"]
      .filter(Boolean)
      .join(" · "),
    amount: item.amount,
    muted: !item.active,
    values: {
      name: item.name,
      amount: halereToCzk(item.amount),
      day: item.day ?? "",
      active: item.active,
    },
  }));

  const yearlyItems: CrudItem[] = yearly.map((item) => ({
    id: item.id,
    title: item.name,
    meta: `platí se v ${MONTH_NAMES[item.dueMonth - 1] ?? item.dueMonth}${
      item.active ? "" : " · vypnuté"
    }`,
    amount: item.amount,
    muted: !item.active,
    values: {
      name: item.name,
      amount: halereToCzk(item.amount),
      dueMonth: item.dueMonth,
      active: item.active,
    },
  }));

  // Instalments live on Dluhy — here they are context, so the monthly total is
  // not silently missing a few thousand crowns.
  const debtItems: CrudItem[] = debtRows
    .filter((debt) => debt.active)
    .map((debt) => ({
      id: debt.id,
      title: `Splátka — ${debt.creditor}`,
      meta: debt.installmentDay
        ? `splatnost ${debt.installmentDay}. · spravuje se v Dluzích`
        : "spravuje se v Dluzích",
      amount: debt.installmentAmount,
      muted: true,
      values: {},
    }));

  const cancellable = [
    ...subs.filter((item) => item.active).map((item) => ({
      id: item.id,
      name: item.name,
      amount: item.amount,
    })),
    ...monthly.filter((item) => item.active).map((item) => ({
      id: item.id + 100_000, // keep the two id spaces apart in the simulator
      name: item.name,
      amount: item.amount,
    })),
  ];

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Pravidelné</h1>
          <p className="page-sub">
            <MonthLabel month={month} /> ·{" "}
            {subs.length + monthly.length + yearly.length === 0
              ? "zatím tu nic pravidelného není"
              : outstanding === 0
                ? "všechno zaplacené"
                : `${outstanding} k zaplacení`}
          </p>
        </div>
        <MonthPicker months={months} current={month} basePath="/pravidelne" />
      </header>

      <section className="tiles">
        <article className="tile">
          <h2>Měsíčně</h2>
          <p className="tile-value numo-numeric">{formatCzk(perMonth)}</p>
          <p className="tile-note">předplatná + měsíční platby</p>
        </article>
        <article className="tile">
          <h2>Ročně</h2>
          <p className="tile-value numo-numeric">{formatCzk(perYear)}</p>
          <p className="tile-note">včetně ročních plateb</p>
        </article>
        <article className="tile">
          <h2>Splátky dluhů</h2>
          <p className="tile-value numo-numeric">
            {formatCzk(
              debtRows.reduce(
                (sum, debt) => (debt.active ? sum + debt.installmentAmount : sum),
                0,
              ),
            )}
          </p>
          <p className="tile-note">měsíčně, mimo rozpočet</p>
        </article>
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Předplatná</h2>
          <p className="card-sub">
            Malé částky, které odcházejí samy. Odškrtni, co je za{" "}
            <MonthLabel month={month} /> zaplacené.
          </p>
        </header>
        <CrudList
          endpoint="/api/subscriptions"
          describe="Předplatné"
          addLabel="+ přidat předplatné"
          emptyNote="Zatím žádná předplatná. Zkus je nechat najít ve výpisu níž."
          items={subItems.map((item) => ({
            ...item,
            meta: item.meta,
          }))}
          fields={SUBSCRIPTION_FIELDS}
        />

        <div className="paid-strip">
          {subs
            .filter((item) => item.active)
            .map((item) => (
              <PaidToggle
                key={item.id}
                itemType="subscription"
                itemId={item.id}
                month={month}
                paid={paid.has(`subscription:${item.id}`)}
                label={item.name}
              />
            ))}
        </div>
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Najít ve výpisu</h2>
          <p className="card-sub">
            Pravidelné platby se poznají počítáním, ne odhadem — stejná částka
            u stejného obchodníka nejmíň třikrát.
          </p>
        </header>
        <DetectedSubscriptions />
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Měsíční platby</h2>
          <p className="card-sub">Nájem, energie, telefon — velké pravidelné výdaje.</p>
        </header>
        <CrudList
          endpoint="/api/recurring-monthly"
          describe="Platba"
          addLabel="+ přidat měsíční platbu"
          items={monthlyItems}
          fields={MONTHLY_FIELDS}
        />

        <div className="paid-strip">
          {monthly
            .filter((item) => item.active)
            .map((item) => (
              <PaidToggle
                key={item.id}
                itemType="monthly"
                itemId={item.id}
                month={month}
                paid={paid.has(`monthly:${item.id}`)}
                label={item.name}
              />
            ))}
        </div>

        {debtItems.length > 0 ? (
          <>
            <p className="card-sub card-sub-inline">
              A k tomu splátky dluhů — počítají se do měsíce, ale mění se na
              stránce Dluhy.
            </p>
            <ul className="crud-list">
              {debtItems.map((item) => (
                <li key={item.id} className="crud-row is-muted">
                  <span className="crud-main">
                    <span className="crud-title">{item.title}</span>
                    <span className="crud-meta">{item.meta}</span>
                  </span>
                  <span className="numo-numeric crud-amount">
                    {formatCzk(item.amount ?? 0)}
                  </span>
                  <span className="crud-actions crud-actions-empty" />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Roční platby</h2>
          <p className="card-sub">
            Pojistky, domény, poplatky. Připomenou se v měsíci splatnosti.
          </p>
        </header>
        <CrudList
          endpoint="/api/recurring-yearly"
          describe="Roční platba"
          addLabel="+ přidat roční platbu"
          items={yearlyItems}
          fields={YEARLY_FIELDS}
        />

        <div className="paid-strip">
          {yearly
            .filter((item) => item.active && item.dueMonth === monthNumber)
            .map((item) => (
              <PaidToggle
                key={item.id}
                itemType="yearly"
                itemId={item.id}
                month={month}
                paid={paid.has(`yearly:${item.id}`)}
                label={item.name}
              />
            ))}
        </div>
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Co když to zrušíme</h2>
          <p className="card-sub">
            Nic se neuloží — je to jen počítání nahlas.
          </p>
        </header>
        <CancelSimulator items={cancellable} />
      </section>
    </>
  );
}

const SUBSCRIPTION_FIELDS = [
  { name: "name", label: "Název", type: "text" as const, required: true },
  { name: "amount", label: "Částka (Kč)", type: "money" as const, required: true, half: true },
  { name: "day", label: "Den v měsíci", type: "int" as const, half: true, hint: "1–31, nepovinné" },
  { name: "active", label: "Běží", type: "bool" as const },
];

const MONTHLY_FIELDS = [
  { name: "name", label: "Název", type: "text" as const, required: true },
  { name: "amount", label: "Částka (Kč)", type: "money" as const, required: true, half: true },
  { name: "day", label: "Den splatnosti", type: "int" as const, half: true, hint: "1–31, nepovinné" },
  { name: "active", label: "Aktivní", type: "bool" as const },
];

const YEARLY_FIELDS = [
  { name: "name", label: "Název", type: "text" as const, required: true },
  { name: "amount", label: "Částka (Kč)", type: "money" as const, required: true, half: true },
  { name: "dueMonth", label: "Měsíc splatnosti", type: "int" as const, required: true, half: true, hint: "1–12" },
  { name: "active", label: "Aktivní", type: "bool" as const },
];
