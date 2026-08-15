import type { MonthResult } from "@/lib/calc/cashflow";
import { formatCzk } from "@/lib/money";

/**
 * Income against spending, month by month.
 *
 * Two bars per month rather than one net bar: the net number hides whether a
 * good month came from earning more or spending less, and those call for
 * different decisions. Forecast months are hatched and labelled, so a
 * projection is never mistaken for a fact — the pattern carries that, not the
 * colour, because colour alone would vanish in greyscale or for a colour-blind
 * reader.
 */
export function CashflowChart({ months }: { months: MonthResult[] }) {
  if (months.length === 0) {
    return <p className="empty-note">Zatím není z čeho kreslit.</p>;
  }

  const peak = months.reduce(
    (max, month) => Math.max(max, month.income, month.expenses),
    1,
  );

  return (
    <div className="chart">
      <ul className="chart-bars">
        {months.map((month) => {
          const forecast = month.kind === "forecast";
          return (
            <li key={month.month} className="chart-col">
              <span className="chart-stack">
                <span
                  className={`chart-bar is-income${forecast ? " is-forecast" : ""}`}
                  style={{ height: `${(month.income / peak) * 100}%` }}
                  title={`${month.month} — přišlo ${formatCzk(month.income)}`}
                />
                <span
                  className={`chart-bar is-expense${forecast ? " is-forecast" : ""}`}
                  style={{ height: `${(month.expenses / peak) * 100}%` }}
                  title={`${month.month} — utraceno ${formatCzk(month.expenses)}`}
                />
              </span>
              <span className="chart-label">
                {month.month.slice(5)}
                {month.month.slice(5) === "01" ? `/${month.month.slice(2, 4)}` : ""}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="chart-legend">
        <span className="legend-key is-income" aria-hidden="true" /> přišlo
        <span className="legend-key is-expense" aria-hidden="true" /> utraceno
        <span className="legend-key is-forecast" aria-hidden="true" /> šrafované
        = odhad
      </p>
    </div>
  );
}
