import Link from "next/link";
import { MonthLabel } from "./money";

/**
 * Month navigation as plain links, so it works without JavaScript and every
 * month is a shareable URL.
 */
export function MonthPicker({
  months,
  current,
  basePath,
}: {
  months: string[];
  current: string;
  basePath: string;
}) {
  const index = months.indexOf(current);
  const previous = index > 0 ? months[index - 1] : null;
  const next = index >= 0 && index < months.length - 1 ? months[index + 1] : null;
  const href = (month: string) =>
    `${basePath}?mesic=${month}`.replace("/?", "/?");

  return (
    <nav className="month-picker" aria-label="Výběr měsíce">
      {previous ? (
        <Link href={href(previous)} aria-label="Předchozí měsíc">
          ‹
        </Link>
      ) : (
        <span aria-hidden="true">‹</span>
      )}

      <strong>
        <MonthLabel month={current} />
      </strong>

      {next ? (
        <Link href={href(next)} aria-label="Další měsíc">
          ›
        </Link>
      ) : (
        <span aria-hidden="true">›</span>
      )}
    </nav>
  );
}
