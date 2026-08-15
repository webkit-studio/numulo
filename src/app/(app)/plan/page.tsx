import type { Metadata } from "next";
import { CrudList } from "@/components/crud/crud-list";
import type { CrudItem } from "@/components/crud/types";
import { MonthLabel, Money } from "@/components/money";
import { MonthPicker } from "@/components/month-picker";
import {
  getCategories,
  getDefaultMonth,
  getEnvelopes,
  getMonthBalance,
  getMonthsWithData,
  getSettings,
} from "@/lib/data/queries";
import { getMonthlyGoal, getPlannedItems } from "@/lib/data/plan";
import { formatCzk, halereToCzk } from "@/lib/money";
import { SavingsForm } from "./savings-form";

export const metadata: Metadata = { title: "numo — plán" };
export const dynamic = "force-dynamic";

const MONTH_NAMES = [
  "leden", "únor", "březen", "duben", "květen", "červen",
  "červenec", "srpen", "září", "říjen", "listopad", "prosinec",
];

export default async function PlanPage({
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

  const [goal, balance, planned, categories, envelopes, settings] =
    await Promise.all([
      getMonthlyGoal(month),
      getMonthBalance(month),
      getPlannedItems(),
      getCategories(),
      getEnvelopes(month),
      getSettings(),
    ]);

  const spentByCategory = new Map(envelopes.map((e) => [e.id, e.spent]));

  const plannedItems: CrudItem[] = planned.map((item) => ({
    id: item.id,
    title: item.name,
    meta: [
      item.direction === "income" ? "příjem" : "výdaj",
      item.interval === "monthly"
        ? "každý měsíc"
        : item.month
          ? monthLabel(item.month)
          : "bez měsíce",
      item.active ? null : "vypnuto",
    ]
      .filter(Boolean)
      .join(" · "),
    amount: item.direction === "income" ? item.amount : -item.amount,
    muted: !item.active,
    values: {
      name: item.name,
      amount: halereToCzk(item.amount),
      direction: item.direction,
      interval: item.interval,
      month: item.month ?? "",
      active: item.active,
    },
  }));

  const budgetItems: CrudItem[] = categories.map((category) => {
    const spent = spentByCategory.get(category.id) ?? 0;
    return {
      id: category.id,
      title: category.name,
      meta:
        category.monthlyLimit === null
          ? `utraceno ${formatCzk(spent)} · rozpočet nenastavený`
          : `utraceno ${formatCzk(spent)} z ${formatCzk(category.monthlyLimit)}`,
      amount: category.monthlyLimit,
      values: {
        name: category.name,
        color: category.color,
        monthlyLimit:
          category.monthlyLimit === null ? "" : halereToCzk(category.monthlyLimit),
        inEnvelopes: true,
      },
    };
  });

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Plán</h1>
          <p className="page-sub">
            <MonthLabel month={month} /> · kolik je potřeba vydělat a kam to jde
          </p>
        </div>
        <MonthPicker months={months} current={month} basePath="/plan" />
      </header>

      <section className="tiles">
        <article className="tile">
          <h2>Potřeba vydělat</h2>
          <p className="tile-value">
            <Money value={goal.needed} />
          </p>
          <p className="tile-note">
            rozpočet {formatCzk(goal.neededBreakdown.budget)}
            {goal.neededBreakdown.debtInstalments > 0
              ? ` + splátky ${formatCzk(goal.neededBreakdown.debtInstalments)}`
              : ""}
          </p>
        </article>

        <article className="tile">
          <h2>Přišlo</h2>
          <p className="tile-value">
            <Money value={goal.received} />
          </p>
          <p className="tile-note">bez převodů mezi vlastními účty</p>
        </article>

        <article className="tile">
          <h2>Na cestě</h2>
          <p className="tile-value">
            <Money value={goal.onTheWay} />
          </p>
          <p className="tile-note">plánované příjmy tenhle měsíc</p>
        </article>

        <article className={`tile${goal.covered ? " is-good" : " is-alert"}`}>
          <h2>{goal.covered ? "Máme navíc" : "Chybí"}</h2>
          <p className="tile-value">
            <Money value={goal.covered ? goal.extra : goal.missing} />
          </p>
          <p className="tile-note">
            {goal.covered
              ? "cíl měsíce je pokrytý"
              : "tolik ještě musí přijít"}
          </p>
        </article>
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Spoření</h2>
          <p className="card-sub">
            Kolik z toho, co přijde, jde bokem — než se to stihne utratit.
          </p>
        </header>
        <SavingsForm
          mode={settings?.savingsMode ?? "amount"}
          value={settings?.savingsValue ?? 0}
          received={balance.received}
        />
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Plánované položky</h2>
          <p className="card-sub">
            Příjmy a výdaje, o kterých už víme, ale zatím nedorazily. Počítají se
            do „na cestě".
          </p>
        </header>
        <CrudList
          endpoint="/api/planned"
          describe="Položka"
          addLabel="+ přidat plánovanou položku"
          emptyNote="Nic naplánovaného. Přidej fakturu, co má dorazit, nebo výdaj, o kterém víš dopředu."
          items={plannedItems}
          fields={[
            { name: "name", label: "Název", type: "text", required: true },
            { name: "amount", label: "Částka (Kč)", type: "money", required: true, half: true },
            {
              name: "direction",
              label: "Směr",
              type: "enum",
              half: true,
              options: [
                { value: "income", label: "příjem" },
                { value: "expense", label: "výdaj" },
              ],
            },
            {
              name: "interval",
              label: "Opakování",
              type: "enum",
              half: true,
              options: [
                { value: "once", label: "jednorázově" },
                { value: "monthly", label: "každý měsíc" },
              ],
            },
            {
              name: "month",
              label: "Měsíc",
              type: "month",
              half: true,
              hint: "jen u jednorázových",
            },
            { name: "active", label: "Aktivní", type: "bool" },
          ]}
        />
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Rozpočty kategorií</h2>
          <p className="card-sub">
            Strop na měsíc pro každou obálku. Prázdné pole znamená „bez stropu" —
            kategorie se pak jen sleduje.
          </p>
        </header>
        <CrudList
          endpoint="/api/categories"
          describe="Kategorie"
          addLabel="+ přidat kategorii"
          items={budgetItems}
          fields={[
            { name: "name", label: "Název", type: "text", required: true },
            { name: "color", label: "Barva", type: "text", half: true, placeholder: "#6f7cff" },
            {
              name: "monthlyLimit",
              label: "Rozpočet (Kč)",
              type: "money",
              half: true,
              hint: "prázdné = bez stropu",
            },
            { name: "inEnvelopes", label: "Zobrazit mezi obálkami", type: "bool" },
          ]}
        />
      </section>
    </>
  );
}

function monthLabel(month: string): string {
  const index = Number(month.slice(5, 7)) - 1;
  return `${MONTH_NAMES[index] ?? month} ${month.slice(0, 4)}`;
}
