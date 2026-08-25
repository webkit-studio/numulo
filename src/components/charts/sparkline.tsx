import { smoothPath } from "./scale";

/**
 * Six months of one category, in that category's colour.
 *
 * No axis and no numbers: the shape is the whole message, and the figure that
 * matters — this month, and how far it sits from the average — is spelled out
 * beside it in words.
 */
export function Sparkline({ series, color }: { series: number[]; color: string }) {
  if (series.length < 2) return <span className="spark spark-empty">–</span>;

  const highest = Math.max(...series);
  const lowest = Math.min(...series);
  const span = highest - lowest || 1;

  const coords = series.map((value, index) => ({
    x: (index / (series.length - 1)) * 320,
    // 6px of padding top and bottom so the line and its end dot are not clipped.
    y: 40 - ((value - lowest) / span) * 34,
  }));

  const last = coords[coords.length - 1];

  return (
    <svg className="spark" viewBox="0 0 320 46" width="320" height="46" aria-hidden="true">
      <path d={smoothPath(coords)} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={last.x} cy={last.y} r="3.5" fill={color} />
    </svg>
  );
}
