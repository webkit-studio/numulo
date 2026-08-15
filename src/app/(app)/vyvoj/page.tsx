import type { Metadata } from "next";
import { CashLine } from "@/components/cash-line";
import { CashflowChart } from "@/components/cashflow-chart";
import { MonthLabel, Money } from "@/components/money";
import { getTrends } from "@/lib/data/trends";
import { getDefaultMonth } from "@/lib/data/queries";
import { formatCzk } from "@/lib/money";

export const metadata: Metadata = { title: "numo — vývoj" };
export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const today = new Date().toISOString().slice(0, 10);
  const month = await getDefaultMonth(today);
  const trends = await getTrends(month);

  const all = [...trends.months, ...trends.forecasts];
  const lastComplete = trends.months[trends.months.length - 1];
  const nextMonth = trends.forecasts[0];

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Vývoj</h1>
          <p className="page-sub">
            {trends.months.length} odžitých měsíců a {trends.forecasts.length}{" "}
            odhadnutých dopředu
          </p>
        </div>
      </header>

      <section className="tiles">
        <article className="tile">
          <h2>Průměrně utraceno</h2>
          <p className="tile-value">
            <Money value={trends.averageExpenses} />
          </p>
          <p className="tile-note">měsíčně, posledních 6 měsíců</p>
        </article>

        <article className="tile">
          <h2>Průměrně přišlo</h2>
          <p className="tile-value">
            <Money value={trends.averageIncome} />
          </p>
          <p className="tile-note">
            posledních 6 měsíců, bez převodů mezi vlastními účty
          </p>
        </article>

        <article className="tile">
          <h2>Proměnlivé útraty</h2>
          <p className="tile-value">
            <Money value={trends.variableAverage} />
          </p>
          <p className="tile-note">
            {trends.hasRecurring
              ? "průměr za 6 měsíců, bez pravidelných plateb"
              : "průměr za 6 měsíců — zatím totéž co všechny útraty, protože pravidelné platby nejsou zadané"}
          </p>
        </article>

        <article
          className={`tile${
            nextMonth && nextMonth.result < 0 ? " is-alert" : " is-good"
          }`}
        >
          <h2>Příští měsíc</h2>
          <p className="tile-value">
            <Money value={nextMonth?.result ?? 0} />
          </p>
          <p className="tile-note">
            {nextMonth ? (
              <>
                odhad výsledku <MonthLabel month={nextMonth.month} />
              </>
            ) : (
              "chybí data"
            )}
          </p>
        </article>
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Přišlo a utraceno</h2>
          <p className="card-sub">
            Dva sloupce místo jednoho čistého: čistý výsledek zamlčí, jestli byl
            měsíc dobrý díky většímu příjmu, nebo menším útratám — a to jsou dvě
            různá rozhodnutí.
          </p>
        </header>
        <CashflowChart months={all} />
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Hotovost v čase</h2>
          <p className="card-sub">
            Plná čára je skutečnost, tečkovaná odhad. Odhad staví na
            pravidelných platbách, splátkách a šestiměsíčním průměru
            proměnlivých útrat.
            {trends.cashStartsAt ? (
              <>
                {" "}Začíná v {trends.cashStartsAt} — od zadaného počátečního
                stavu. Co bylo dřív, je historie: sytí průměry, ale zůstatek
                z ní numo nezná a nebude si ho domýšlet.
              </>
            ) : null}
          </p>
        </header>
        <CashLine points={trends.cash} />
      </section>

      {nextMonth ? (
        <section className="card">
          <header className="card-head">
            <h2>
              Z čeho se odhad skládá — <MonthLabel month={nextMonth.month} />
            </h2>
            <p className="card-sub">
              Splátky dluhů stojí na obou stranách schválně: zvednutý cíl je
              vydělá, takže výsledek měsíce neovlivní a nesnědí rozpočet
              domácnosti.
            </p>
          </header>

          <ul className="crud-list">
            {[
              ["Rozpočet domácnosti", nextMonth.breakdown.budget, "příjem"],
              ["Splátky dluhů (vydělat)", nextMonth.breakdown.debtInstalments, "příjem"],
              ["Plánované příjmy", nextMonth.breakdown.plannedIncome, "příjem"],
              ["Měsíční platby", nextMonth.breakdown.recurringMonthly, "výdaj"],
              ["Předplatná", nextMonth.breakdown.subscriptions, "výdaj"],
              ["Roční platby splatné tenhle měsíc", nextMonth.breakdown.yearlyDue, "výdaj"],
              ["Splátky dluhů (zaplatit)", nextMonth.breakdown.debtInstalments, "výdaj"],
              ["Plánované výdaje", nextMonth.breakdown.plannedExpenses, "výdaj"],
              ["Proměnlivé útraty (průměr)", nextMonth.breakdown.variableAverage, "výdaj"],
            ]
              .filter(([, value]) => (value as number) !== 0)
              .map(([label, value, side]) => (
                <li key={label as string} className="crud-row">
                  <span className="crud-main">
                    <span className="crud-title">{label as string}</span>
                    <span className="crud-meta">{side as string}</span>
                  </span>
                  <span className="numo-numeric crud-amount">
                    {formatCzk(value as number)}
                  </span>
                  <span className="crud-actions crud-actions-empty" />
                </li>
              ))}
          </ul>
        </section>
      ) : null}

      {lastComplete ? (
        <section className="card">
          <header className="card-head">
            <h2>Měsíc po měsíci</h2>
          </header>
          <ul className="crud-list">
            {[...trends.months].reverse().map((row) => (
              <li key={row.month} className="crud-row">
                <span className="crud-main">
                  <span className="crud-title">
                    <MonthLabel month={row.month} />
                  </span>
                  <span className="crud-meta">
                    přišlo {formatCzk(row.income)} · utraceno{" "}
                    {formatCzk(row.expenses)}
                  </span>
                </span>
                <span
                  className={`numo-numeric crud-amount${row.result < 0 ? " is-negative" : ""}`}
                >
                  {formatCzk(row.result, { sign: row.result > 0 })}
                </span>
                <span className="crud-actions crud-actions-empty" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
