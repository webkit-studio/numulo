import Link from "next/link";
import type { CategorySpend } from "@/lib/data/month";
import { Money } from "./money";

/**
 * Envelopes: a category, its ceiling, and how much room is left.
 *
 * State is always a word next to the bar — "v klidu / dochází / nad plánem" —
 * never the colour on its own. An overflowing envelope shows the overspend as
 * a second red segment and says where it is covered from, because a bar that
 * simply stops at 100 % hides exactly the number that matters.
 */
export function Envelopes({ categories }: { categories: CategorySpend[] }) {
  const shown = categories.filter(
    (category) => category.inEnvelopes && (category.spent > 0 || category.monthlyLimit !== null),
  );

  if (shown.length === 0) {
    return (
      <p className="empty">
        Zatím není co rozdělovat — jakmile budou útraty s kategorií, objeví se tu obálky.
      </p>
    );
  }

  return (
    <ul className="envelopes">
      {shown.map((category) => {
        const { envelope } = category;

        return (
          <li key={category.id} className="envelope">
            <div className="envelope-head">
              <span className="envelope-name">
                <span className="dot" style={{ background: category.color }} aria-hidden="true" />
                {category.name}
                {envelope.state ? (
                  <span className={`envelope-state state-${stateClass(envelope.state)}`}>
                    {envelope.state}
                  </span>
                ) : null}
              </span>

              {envelope.limit === null ? (
                <Link href="/plan" className="envelope-action">nastavit limit ›</Link>
              ) : (
                <span className="envelope-remaining">
                  zbývá <Money value={envelope.remaining ?? 0} />
                </span>
              )}
            </div>

            {category.children.some((child) => child.spent > 0) ? (
              <p className="envelope-children">
                {category.children.filter((child) => child.spent > 0).map((child, index) => (
                  <span key={child.id}>
                    {index > 0 ? " · " : "z toho: "}
                    {child.name} <Money value={child.spent} tone="plain" />
                  </span>
                ))}
              </p>
            ) : null}
            {envelope.limit === null ? (
              <p className="envelope-note">
                utraceno <Money value={category.spent} tone="plain" />
              </p>
            ) : (
              <>
                <div className="bar">
                  <span
                    className="bar-fill"
                    style={{ width: `${envelope.fillPercent}%` }}
                  />
                  {envelope.overPercent > 0 ? (
                    <span className="bar-over" style={{ width: `${envelope.overPercent}%` }} />
                  ) : null}
                </div>
                <p className="envelope-note">
                  utraceno <Money value={category.spent} tone="plain" /> z limitu{" "}
                  <Money value={envelope.limit} tone="plain" />
                  {envelope.remaining !== null && envelope.remaining < 0
                    ? " · kryto z rezervy"
                    : ""}
                </p>
              </>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const stateClass = (state: string) =>
  state === "v klidu" ? "calm" : state === "dochází" ? "low" : "over";
