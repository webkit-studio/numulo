import type { Metadata } from "next";
import { CrudList, type CrudRow } from "@/components/crud-list";
import { Money } from "@/components/money";
import { MonthPicker } from "@/components/month-picker";
import { Info } from "@/components/tooltip";
import { Budgets } from "./budgets";
import { SavingsForm } from "./savings-form";
import { getSession } from "@/lib/data/household";
import { getListRows } from "@/lib/data/lists";
import { getMonthSnapshot } from "@/lib/data/month";
import { getMonthsWithData, resolveMonth, todayIso } from "@/lib/data/months";
import { monthNameOnly } from "@/lib/date";
import { formatCzk } from "@/lib/money";
import { monthResult } from "@/lib/calc";

export const metadata: Metadata = { title: "Numulo — plán" };
export const dynamic = "force-dynamic";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { household } = await getSession();
  if (!household) return null;

  const today = todayIso();
  const months = await getMonthsWithData(household.id, today);
  const month = resolveMonth(params.mesic, months, today);

  const [snapshot, plannedRows] = await Promise.all([
    getMonthSnapshot(household, month, today),
    getListRows(household.id, "planned"),
  ]);

  const { goal } = snapshot;
  const coveredPercent = goal.needed === 0 ? 0 : Math.min(100, (goal.received / goal.needed) * 100);
  const onTheWayPercent =
    goal.needed === 0 ? 0 : Math.min(100 - coveredPercent, (goal.onTheWay / goal.needed) * 100);

  // The closing line: what the month leaves behind if the plan holds.
  const result = monthResult(
    month,
    goal.received + goal.onTheWay,
    snapshot.spending + snapshot.planned,
    snapshot.isCurrentMonth ? "forecast" : "actual",
  );

  const rows: CrudRow[] = plannedRows.map((row) => {
    const income = row.direction === "income";
    const once = row.interval === "once";

    return {
      id: row.id,
      values: row,
      view: (
        <>
          <span className="crud-name">
            {String(row.name)}
            {once && row.month ? (
              <span className="badge">{monthNameOnly(String(row.month))}</span>
            ) : (
              <span className="badge badge-quiet">měsíčně</span>
            )}
            <span className={`badge ${income ? "badge-in" : "badge-out"}`}>
              {income ? "příjem" : "výdaj"}
            </span>
          </span>
          <span className="crud-amount">
            <Money value={income ? Number(row.amount) : -Number(row.amount)} sign />
          </span>
        </>
      ),
    };
  });

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Plán</h1>
          <p className="page-sub">jak nastavíme a zvládáme tenhle měsíc</p>
        </div>
        <MonthPicker months={months.all} current={month} />
      </header>

      <div className="row">
        {/* ── Cíl měsíce ────────────────────────────────────────────── */}
        <section className="card grow-2">
          <div className="card-head">
            <h2 className="card-title">
              Cíl měsíce{" "}
              <Info>
                Rozpočet domácnosti {formatCzk(snapshot.monthlyBudget)} (výdaje + spoření) +
                splátky dluhů {formatCzk(goal.needed - snapshot.monthlyBudget)} ={" "}
                {formatCzk(goal.needed)}.
              </Info>
            </h2>
          </div>

          <dl className="goal">
            <div className="goal-row">
              <dt>potřeba měsíce</dt>
              <dd><Money value={goal.needed} tone="plain" /></dd>
            </div>
            <div className="goal-row">
              <dt>přišlo</dt>
              <dd><Money value={goal.received} tone="plain" /></dd>
            </div>
            <div className="goal-row">
              <dt>na cestě</dt>
              <dd><Money value={goal.onTheWay} tone="plain" /></dd>
            </div>
            <div className="goal-row is-total">
              <dt>{goal.covered ? "nad cíl" : "schází"}</dt>
              <dd>
                <Money
                  value={goal.covered ? goal.extra : goal.missing}
                  tone={goal.covered ? "positive" : "auto"}
                />
              </dd>
            </div>
          </dl>

          <div className="bar bar-goal">
            <span className="bar-fill" style={{ width: `${coveredPercent}%` }} />
            <span className="bar-soft" style={{ width: `${onTheWayPercent}%` }} />
          </div>
        </section>

        {/* ── Spoření ───────────────────────────────────────────────── */}
        <section className="card grow-1">
          <div className="card-head"><h2 className="card-title">Spoření</h2></div>
          <SavingsForm
            householdId={household.id}
            mode={household.savings_mode as "amount" | "percent"}
            value={Number(household.savings_value)}
            monthlyBudget={Number(household.monthly_budget)}
          />
        </section>
      </div>

      {/* ── Plánované příjmy a výdaje ───────────────────────────────── */}
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Plánované příjmy a výdaje</h2>
          <span className="card-sub">
            výdaje jdou do dlaždice „plánované“, příjmy do řádku „na cestě“
          </span>
        </div>
        <CrudList
          listKey="planned"
          householdId={household.id}
          rows={rows}
          empty="Zatím nic naplánovaného — přidej první položku níž."
        />
      </section>

      {/* ── Rozpočty ────────────────────────────────────────────────── */}
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Rozpočty</h2>
          <span className="card-sub">kategorie, jejich rozpočty a skutečný stav</span>
        </div>
        <Budgets categories={snapshot.categories} />
      </section>

      <p className={`page-close ${result.result < 0 ? "warn" : "pos"}`}>
        výsledek měsíce podle plánu <Money value={result.result} sign />
      </p>
    </>
  );
}
