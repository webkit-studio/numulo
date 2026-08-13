import type { TransactionRow } from "@/lib/data/queries";
import { formatCzk } from "@/lib/money";
import { formatDayMonth } from "./money";

/** Groups by day, newest first — the shape a bank statement is read in. */
export function TransactionList({
  transactions,
  emptyNote = "Žádné transakce.",
}: {
  transactions: TransactionRow[];
  emptyNote?: string;
}) {
  if (transactions.length === 0) {
    return <p className="empty-note">{emptyNote}</p>;
  }

  const byDay = new Map<string, TransactionRow[]>();
  for (const row of transactions) {
    const group = byDay.get(row.date) ?? [];
    group.push(row);
    byDay.set(row.date, group);
  }

  return (
    <div className="tx-groups">
      {[...byDay.entries()].map(([date, rows]) => {
        const dayTotal = rows.reduce(
          (sum, row) => (row.amount < 0 ? sum - row.amount : sum),
          0,
        );

        return (
          <section key={date} className="tx-group">
            <header className="tx-group-head">
              <h3>{formatDayMonth(date)}</h3>
              {dayTotal > 0 ? (
                <span className="numo-numeric tx-day-total">
                  {formatCzk(dayTotal)}
                </span>
              ) : null}
            </header>

            <ul className="tx-list">
              {rows.map((row) => (
                <li key={row.id} className="tx-row">
                  <span className="tx-main">
                    <span className="tx-merchant">
                      {row.merchant || row.description || "—"}
                    </span>
                    <span className="tx-meta">
                      {row.categoryName ? (
                        <span className="tx-chip">
                          <span
                            className="envelope-dot"
                            style={{ background: row.categoryColor ?? "" }}
                            aria-hidden="true"
                          />
                          {row.categoryName}
                        </span>
                      ) : (
                        <span className="tx-chip is-empty">bez kategorie</span>
                      )}
                      {row.ownerName ? (
                        <span className="tx-owner">{row.ownerName}</span>
                      ) : null}
                      {row.isBusiness ? (
                        <span className="tx-chip is-flag">podnikání</span>
                      ) : null}
                      {row.isTransfer ? (
                        <span className="tx-chip is-flag">převod</span>
                      ) : null}
                    </span>
                  </span>

                  <span
                    className={`numo-numeric tx-amount${row.amount > 0 ? " is-income" : ""}`}
                  >
                    {formatCzk(row.amount, { sign: row.amount > 0 })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
