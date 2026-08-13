import Link from "next/link";
import type { Envelope } from "@/lib/data/queries";
import { formatCzk } from "@/lib/money";

/**
 * Envelopes. A category with a limit shows what is left and a two-segment bar
 * (spent | remaining) with a 2px surface gap between the segments; one without
 * shows what was spent and an invitation to set a limit.
 *
 * The state is spelled out in words next to the bar, so "over budget" is never
 * carried by colour alone.
 */
export function Envelopes({ envelopes }: { envelopes: Envelope[] }) {
  const withActivity = envelopes.filter(
    (envelope) => envelope.spent > 0 || envelope.limit !== null,
  );

  if (withActivity.length === 0) {
    return (
      <p className="empty-note">
        Zatím tu není co rozdělit — v tomhle měsíci nejsou žádné útraty
        s kategorií.
      </p>
    );
  }

  return (
    <ul className="envelopes">
      {withActivity.map((envelope) => {
        const over = envelope.remaining !== null && envelope.remaining < 0;
        const share =
          envelope.limit && envelope.limit > 0
            ? Math.min(100, (envelope.spent / envelope.limit) * 100)
            : 0;

        return (
          <li key={envelope.id} className="envelope">
            <div className="envelope-head">
              <span className="envelope-name">
                <span
                  className="envelope-dot"
                  style={{ background: envelope.color }}
                  aria-hidden="true"
                />
                {envelope.name}
              </span>

              {envelope.limit === null ? (
                <span className="envelope-value">
                  <span className="numo-numeric">
                    {formatCzk(envelope.spent)}
                  </span>
                  <Link href="/plan" className="envelope-action">
                    nastavit limit ›
                  </Link>
                </span>
              ) : (
                <span className="envelope-value">
                  <span className="numo-numeric">
                    {formatCzk(Math.abs(envelope.remaining ?? 0))}
                  </span>
                  <span className="envelope-state">
                    {over ? "přes limit" : "zbývá"}
                  </span>
                </span>
              )}
            </div>

            {envelope.limit === null ? null : (
              <div
                className="envelope-bar"
                role="img"
                aria-label={`${envelope.name}: utraceno ${formatCzk(envelope.spent)} z ${formatCzk(envelope.limit)}`}
              >
                <span
                  className={`envelope-fill${over ? " is-over" : ""}`}
                  style={{ width: `${share}%`, background: envelope.color }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
