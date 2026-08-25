import { Money } from "./money";
import { dayHeading } from "@/lib/date";
import type { TransactionRow } from "@/lib/data/month";

/**
 * The transaction feed.
 *
 * Grouped by day with a daily total, because "what did Tuesday cost" is the
 * question someone scrolling a statement is actually asking. Rows marked
 * business or transfer are dimmed and left out of the total — they are out of
 * every other number too, and a total that disagreed with them would be the
 * one place the app contradicts itself.
 */
export function TransactionList({
  transactions,
  today,
  grouped = true,
  emptyNote = "Žádné transakce.",
  memberInitials,
}: {
  transactions: TransactionRow[];
  today: string;
  grouped?: boolean;
  emptyNote?: string;
  memberInitials?: Map<string, string>;
}) {
  if (transactions.length === 0) return <p className="empty">{emptyNote}</p>;

  if (!grouped) {
    return (
      <ul className="tx-list">
        {transactions.map((tx) => (
          <Row key={tx.id} tx={tx} today={today} memberInitials={memberInitials} />
        ))}
      </ul>
    );
  }

  const byDay = new Map<string, TransactionRow[]>();
  for (const tx of transactions) {
    const group = byDay.get(tx.date) ?? [];
    group.push(tx);
    byDay.set(tx.date, group);
  }

  return (
    <div className="tx-groups">
      {[...byDay.entries()].map(([date, rows]) => {
        const total = rows.reduce(
          (sum, tx) =>
            tx.amount < 0 && !tx.isBusiness && !tx.isTransfer ? sum - tx.amount : sum,
          0,
        );

        return (
          <section key={date}>
            <header className="tx-day">
              <h3 className="tx-day-name">{dayHeading(date, today)}</h3>
              {total > 0 ? (
                <span className="tx-day-total"><Money value={total} tone="plain" /></span>
              ) : null}
            </header>
            <ul className="tx-list">
              {rows.map((tx) => (
                <Row key={tx.id} tx={tx} today={today} memberInitials={memberInitials} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Row({
  tx,
  today,
  memberInitials,
}: {
  tx: TransactionRow;
  today: string;
  memberInitials?: Map<string, string>;
}) {
  const initial = tx.ownerId ? (memberInitials?.get(tx.ownerId) ?? "·") : "·";
  const excluded = tx.isBusiness || tx.isTransfer;

  return (
    <li className={`tx-row${excluded ? " is-muted" : ""}`}>
      <span className="avatar" aria-hidden="true">{initial}</span>

      <span className="tx-main">
        <span className="tx-name">{tx.merchant || tx.description || "—"}</span>
        <span className="tx-meta">
          {tx.categoryName ? (
            <span className="tx-cat">
              <span className="dot" style={{ background: tx.categoryColor ?? "" }} aria-hidden="true" />
              {tx.categoryName}
            </span>
          ) : (
            <span className="tx-cat is-none">bez kategorie</span>
          )}
          {tx.isBusiness ? <span className="badge">podnikání</span> : null}
          {tx.isTransfer ? <span className="badge">převod</span> : null}
        </span>
      </span>

      <span className="tx-amount">
        <Money value={tx.amount} sign={tx.amount > 0} />
      </span>
    </li>
  );
}
