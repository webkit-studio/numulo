import { formatCzk, formatNumber, halereToCzk } from "@/lib/money";

/**
 * A money figure with its unit as a separate, quieter element — the design
 * sets "Kč" smaller and in secondary ink beside every number.
 */
export function Money({
  value,
  sign = false,
  tone = "auto",
  className = "",
}: {
  value: number;
  sign?: boolean;
  /** 'auto' colours negatives red; 'plain' leaves the ink alone. */
  tone?: "auto" | "plain" | "positive";
  className?: string;
}) {
  const czk = Math.round(halereToCzk(value));
  const colour =
    tone === "positive" ? " pos" : tone === "auto" && czk < 0 ? " neg" : "";

  return (
    <span className={`num${colour} ${className}`.trim()}>
      {formatCzk(value, { sign, unit: false })}
      <span className="unit">Kč</span>
    </span>
  );
}

/** Bare number, no unit — for counts and percentages. */
export function Num({ value }: { value: number }) {
  return <span className="num">{formatNumber(value)}</span>;
}
