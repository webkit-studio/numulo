import { formatCzk } from "@/lib/money";
import { daysInMonth } from "@/lib/date";

/**
 * Spending by day.
 *
 * One hue in five steps, light to dark — magnitude is ordered, so the colour
 * must be too. Days still to come get a dashed outline rather than a shade,
 * because an empty future day is not a day you spent nothing on.
 */
const STEPS = ["#CFE3D5", "#A8CBB4", "#74AC8C", "#45906A", "#1C6B4A"];

export function Heatmap({
  days,
  month,
  today,
  isCurrentMonth,
}: {
  days: { day: number; spent: number }[];
  month: string;
  today: number;
  isCurrentMonth: boolean;
}) {
  const peak = days.reduce((max, day) => Math.max(max, day.spent), 0);

  // ISO weekday of the 1st, so the grid starts under the right column.
  const first = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const offset = (first + 6) % 7;
  const total = daysInMonth(month);

  return (
    <div className="heatmap">
      <div className="heat-grid" role="grid" aria-label="Útraty po dnech">
        {["po", "út", "st", "čt", "pá", "so", "ne"].map((label) => (
          <span key={label} className="heat-weekday" aria-hidden="true">{label}</span>
        ))}

        {Array.from({ length: offset }, (_, i) => (
          <span key={`pad-${i}`} className="heat-pad" />
        ))}

        {Array.from({ length: total }, (_, index) => {
          const day = index + 1;
          const spent = days.find((d) => d.day === day)?.spent ?? 0;
          const future = isCurrentMonth && day > today;

          return (
            <span
              key={day}
              className={`heat-cell${future ? " is-future" : ""}`}
              style={future ? undefined : { background: shade(spent, peak) }}
              title={`${day}. — ${spent > 0 ? formatCzk(spent) : "nic"}`}
            >
              <span className="heat-day">{day}</span>
            </span>
          );
        })}
      </div>

      <p className="heat-legend">
        <span>méně</span>
        {STEPS.map((step) => (
          <span key={step} className="heat-swatch" style={{ background: step }} />
        ))}
        <span>více</span>
      </p>
    </div>
  );
}

function shade(spent: number, peak: number): string {
  if (spent <= 0) return "rgba(14,62,46,.05)";
  if (peak <= 0) return STEPS[0];
  const index = Math.min(STEPS.length - 1, Math.floor((spent / peak) * STEPS.length));
  return STEPS[index];
}
