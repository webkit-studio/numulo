import { halereToCzk } from "@/lib/money";

/**
 * Axis steps a person would have chosen.
 *
 * A chart whose gridlines read 11 437 · 22 874 · 34 311 is arithmetically
 * correct and useless. The spec asks for a step out of a "nice" series such
 * that four of them clear the maximum, so the labels come out as 3 k · 6 k ·
 * 9 k · 12 k and the eye can measure against them.
 */
const NICE = [
  1, 2, 2.5, 5, 10, 20, 25, 50, 100, 200, 250, 500,
  1_000, 2_000, 2_500, 5_000, 10_000, 12_500, 20_000, 25_000, 50_000,
  100_000, 125_000, 200_000, 250_000, 500_000, 1_000_000,
];

/** Returns the step in haléře such that `step × divisions ≥ maximum`. */
export function niceStep(maximumHalere: number, divisions = 4): number {
  const target = Math.abs(halereToCzk(maximumHalere)) / divisions;
  const step = NICE.find((candidate) => candidate >= target) ?? NICE[NICE.length - 1];
  return Math.round(step * 100);
}

export interface Scale {
  min: number;
  max: number;
  step: number;
  /** Gridline values from bottom to top, always including zero. */
  ticks: number[];
  /** 0–100, where a value sits vertically (0 = bottom). */
  percentOf: (value: number) => number;
}

/**
 * A scale that always contains zero, because every number these charts draw is
 * measured against it — a cashflow month is above or below break-even, a cash
 * balance is above or below empty.
 *
 * `divisions` is a budget for the whole axis, not for each side of zero: a
 * series running from −2 500 to +3 000 gets a coarser step than one running
 * 0 to 3 000, so the axis keeps roughly five gridlines either way instead of
 * turning into a ruler.
 */
export function buildScale(values: readonly number[], divisions = 4): Scale {
  const highest = Math.max(0, ...values);
  const lowest = Math.min(0, ...values);
  const span = highest - lowest;

  // Grow the step until the ticks either side of zero fit inside the budget.
  let step = niceStep(span, divisions);
  while (Math.ceil(highest / step) + Math.ceil(-lowest / step) > divisions + 1) {
    const next = niceStep(step * divisions + 1, divisions);
    if (next <= step) break;
    step = next;
  }

  const above = Math.ceil(highest / step);
  const below = Math.ceil(-lowest / step);
  const max = above * step || step;
  const min = -below * step;
  const height = max - min || step;

  const ticks: number[] = [];
  for (let tick = min; tick <= max + 1; tick += step) ticks.push(tick);

  return {
    min,
    max,
    step,
    ticks,
    percentOf: (value: number) => ((value - min) / height) * 100,
  };
}

/**
 * A smooth path through the points, as a cubic bezier with horizontal control
 * handles. Catmull-Rom would overshoot on a spike, and an overshoot below zero
 * on a cash chart would draw a month into the red that is not.
 */
export function smoothPath(points: readonly { x: number; y: number }[]): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;

  let path = `M ${points[0].x} ${points[0].y}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];
    const handle = (current.x - previous.x) / 2;
    path += ` C ${previous.x + handle} ${previous.y}, ${current.x - handle} ${current.y}, ${current.x} ${current.y}`;
  }
  return path;
}
