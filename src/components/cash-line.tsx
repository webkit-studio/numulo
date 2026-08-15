import type { CashPoint } from "@/lib/calc/cashflow";
import { formatCzk } from "@/lib/money";

/**
 * Hotovost v čase — where the money stands, and where it is heading.
 *
 * The zero line is drawn whenever the range crosses it, because "how far above
 * nothing" is the only reading of this chart anyone actually wants. Months
 * projected below zero get the critical colour *and* a marker, so the warning
 * survives a black-and-white print.
 */
export function CashLine({ points }: { points: CashPoint[] }) {
  if (points.length < 2) {
    return <p className="empty-note">Na čáru je potřeba aspoň pár měsíců.</p>;
  }

  const values = points.map((point) => point.cash);
  const max = Math.max(...values, 0);
  const min = Math.min(...values, 0);
  const span = max - min || 1;

  const width = 100;
  const height = 100;
  const x = (index: number) => (index / (points.length - 1)) * width;
  const y = (value: number) => height - ((value - min) / span) * height;

  const actual = points.filter((point) => point.kind === "actual");
  const line = (subset: CashPoint[], offset: number) =>
    subset
      .map((point, index) => `${x(index + offset)},${y(point.cash)}`)
      .join(" ");

  const zeroY = y(0);
  const firstBelow = points.find((point) => point.belowZero);

  return (
    <div className="cash-line">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Hotovost od ${points[0].month} do ${points[points.length - 1].month}`}
      >
        {min < 0 ? (
          <line
            x1="0"
            x2={width}
            y1={zeroY}
            y2={zeroY}
            className="cash-zero"
            vectorEffect="non-scaling-stroke"
          />
        ) : null}

        <polyline
          points={line(actual, 0)}
          className="cash-actual"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          // Starts on the last actual point so the two halves join up.
          points={line(points.slice(Math.max(actual.length - 1, 0)), Math.max(actual.length - 1, 0))}
          className="cash-forecast"
          vectorEffect="non-scaling-stroke"
        />

        {points.map((point, index) =>
          point.belowZero ? (
            <circle
              key={point.month}
              cx={x(index)}
              cy={y(point.cash)}
              r="2"
              className="cash-alert"
            />
          ) : null,
        )}
      </svg>

      <ul className="cash-scale">
        <li>
          {points[0].month} · <span className="numo-numeric">{formatCzk(points[0].cash)}</span>
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
