import type { DaySpend } from "@/lib/data/queries";
import { formatCzk } from "@/lib/money";

/**
 * Calendar heatmap of daily household spending.
 *
 * Sequential encoding, so one hue light→dark (the blue ramp) — never a rainbow.
 * The lightest step means "near zero" and is allowed to recede toward the
 * surface. Magnitude is also carried in the tooltip text, so the colour is
 * never the only way to read a day.
 */

const STEPS = [
  "var(--viz-seq-100)",
  "var(--viz-seq-200)",
  "var(--viz-seq-300)",
  "var(--viz-seq-450)",
  "var(--viz-seq-600)",
];

function stepFor(spent: number, max: number): string {
  if (spent <= 0) return "var(--viz-empty)";
  if (max <= 0) return STEPS[0];
  // Rank by share of the month's busiest day; the top step is reserved for it.
  const ratio = spent / max;
  const index = Math.min(STEPS.length - 1, Math.floor(ratio * STEPS.length));
  return STEPS[index];
}

const WEEKDAYS = ["po", "út", "st", "čt", "pá", "so", "ne"];

export function Heatmap({ days, month }: { days: DaySpend[]; month: string }) {
  const max = days.reduce((peak, day) => Math.max(peak, day.spent), 0);

  // ISO weekday of the 1st, so the grid starts on the right column.
  const first = new Date(`${month}-01T00:00:00Z`).getUTCDay();
  const offset = (first + 6) % 7;

  return (
    <div className="heatmap">
      <div className="heatmap-grid" role="grid" aria-label="Útraty po dnech">
        {WEEKDAYS.map((label) => (
          <span key={label} className="heatmap-weekday" aria-hidden="true">
            {label}
          </span>
        ))}

        {Array.from({ length: offset }, (_, index) => (
          <span key={`pad-${index}`} className="heatmap-pad" />
        ))}

        {days.map((day) => (
          <span
            key={day.date}
            className="heatmap-cell"
            style={{ background: stepFor(day.spent, max) }}
            title={`${day.day}. — ${day.spent > 0 ? formatCzk(day.spent) : "nic"}`}
          >
            <span className="heatmap-day">{day.day}</span>
          </span>
        ))}
      </div>

      <div className="heatmap-legend">
        <span>nic</span>
        {STEPS.map((step) => (
          <span
            key={step}
            className="heatmap-swatch"
            style={{ background: step }}
          />
        ))}
        <span>
          nejvíc {max > 0 ? formatCzk(max) : "—"}
        </span>
      </div>
    </div>
  );
}
