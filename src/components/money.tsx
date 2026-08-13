import { formatCzk } from "@/lib/money";

/**
 * Money is always tabular so columns of numbers line up, and the sign is part
 * of the value rather than a colour — colour alone would be the only cue for
 * anyone who cannot see it.
 */
export function Money({
  value,
  sign = false,
  precise = false,
  tone,
}: {
  value: number;
  sign?: boolean;
  precise?: boolean;
  tone?: "positive" | "negative" | "muted";
}) {
  return (
    <span className={`numo-numeric${tone ? ` money-${tone}` : ""}`}>
      {formatCzk(value, { sign, precise })}
    </span>
  );
}

export function MonthLabel({ month }: { month: string }) {
  const NAMES = [
    "leden",
    "únor",
    "březen",
    "duben",
    "květen",
    "červen",
    "červenec",
    "srpen",
    "září",
    "říjen",
    "listopad",
    "prosinec",
  ];
  const index = Number(month.slice(5, 7)) - 1;
  return <>{`${NAMES[index] ?? month} ${month.slice(0, 4)}`}</>;
}

export function formatDayMonth(date: string): string {
  return `${Number(date.slice(8, 10))}. ${Number(date.slice(5, 7))}.`;
}
