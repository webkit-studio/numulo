import type { CashPoint } from "@/lib/calc/cashflow";
import { formatCzk } from "@/lib/money";

/**
 * Hotovost v čase — where the money stands, and where it is heading.
 *
 * The zero line is drawn whenever the range crosses it, because "how far above
 * nothing" is the only reading of this chart anyone actually wants. Months
 * projected below zero get the critical colour *and* a marker, so the warning
 * survives a black-and-white print.
 *
 * The viewBox keeps its own aspect ratio rather than being stretched to the
 * container: a squashed chart turns markers into ovals and, worse, makes a
 * gentle slope look like a cliff.
 */

const WIDTH = 600;
const HEIGHT = 160;

export function CashLine({ points }: { points: CashPoint[] }) {
  if (points.length < 2) {
    return (
      <p className="empty-note">
        Na čáru je potřeba aspoň pár měsíců, u kterých numo zná zůstatek.
      </p>
    );
  }

  const values = points.map((point) => point.cash);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const x = (index: number) => (index / (points.length - 1)) * WIDTH;
  const y = (value: number) => HEIGHT - ((value - min) / span) * HEIGHT;

  const actualCount = points.filter((point) => point.kind === "actual").length;
  const path = (subset: CashPoint[], offset: number) =>
    subset.map((point, index) => `${x(index + offset)},${y(point.cash)}`).join(" ");

  // The forecast starts on the last actual point so the two halves join up.
  const joinAt = Math.max(actualCount - 1, 0);
  const zeroY = y(0);
  const firstBelow = points.find((point) => point.belowZero);

  return (
    <div className="cash-line">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`Hotovost od ${points[0].month} do ${points[points.length - 1].month}`}
      >
        {min < 0 ? (
          <line x1="0" x2={WIDTH} y1={zeroY} y2={zeroY} className="cash-zero" />
        ) : null}

        {actualCount > 1 ? (
          <polyline points={path(points.slice(0, actualCount), 0)} className="cash-actual" />
        ) : null}

        {actualCount < points.length ? (
          <polyline points={path(points.slice(joinAt), joinAt)} className="cash-forecast" />
        ) : null}

        {points.map((point, index) =>
          point.belowZero ? (
            <circle
              key={point.month}
              cx={x(index)}
              cy={y(point.cash)}
              r="4"
              className="cash-alert"
            />
          ) : null,
        )}
      </svg>

      <ul className="cash-scale">
        <li>
          {points[0].month} ·{" "}
          <span className="numo-numeric">{formatCzk(points[0].cash)}</span>
        </li>
        <li>
          {points[points.length - 1].month} ·{" "}
          <span className="numo-numeric">
            {formatCzk(points[points.length - 1].cash)}
          </span>
        </li>
      </ul>

      {firstBelow ? (
        <p className="cash-warning">
          Podle odhadu jde hotovost pod nulu v {firstBelow.month}.
        </p>
      ) : null}
    </div>
  );
}
