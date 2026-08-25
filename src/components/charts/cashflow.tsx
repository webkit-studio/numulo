"use client";

import { useState } from "react";
import { buildScale, smoothPath } from "./scale";
import { monthNameOnly } from "@/lib/date";
import { formatCompact, formatCzk } from "@/lib/money";
import type { MonthResult } from "@/lib/calc";

/**
 * Cashflow: what each month earned, not what is in the bank.
 *
 * SVG draws geometry only — grid, curve, dots. Every label is an HTML element
 * positioned in percentages on top of it, which is both what the spec asks for
 * and the only thing that reliably renders: interpolated values inside SVG
 * `<text>` have a habit of coming out blank.
 */
export function Cashflow({ points }: { points: MonthResult[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (points.length === 0) {
    return <p className="empty">–</p>;
  }

  const scale = buildScale(points.map((point) => point.result));
  const anyNegative = points.some((point) => point.result < 0);

  const at = (index: number) => (points.length === 1 ? 50 : (index / (points.length - 1)) * 100);
  const coords = points.map((point, index) => ({
    x: at(index),
    y: 100 - scale.percentOf(point.result),
  }));

  return (
    <div className="chart" onMouseLeave={() => setOpen(null)}>
      <div className="chart-plot">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="chart-svg" aria-hidden="true">
          {anyNegative ? (
            <rect
              x="0"
              y={100 - scale.percentOf(0)}
              width="100"
              height={scale.percentOf(0)}
              className="chart-negative"
            />
          ) : null}

          {scale.ticks.map((tick) => (
            <line
              key={tick}
              x1="0"
              x2="100"
              y1={100 - scale.percentOf(tick)}
              y2={100 - scale.percentOf(tick)}
              className={tick === 0 ? "chart-zero" : "chart-grid"}
              vectorEffect="non-scaling-stroke"
            />
          ))}

          <path d={smoothPath(coords)} className="chart-line" vectorEffect="non-scaling-stroke" />
        </svg>

        {/* Dots and their labels are HTML — see the note above. */}
        {points.map((point, index) => {
          const isOpen = open === point.month;
          return (
            <div
              key={point.month}
              className={`chart-point kind-${point.kind}${isOpen ? " is-open" : ""}`}
              style={{ left: `${coords[index].x}%`, top: `${coords[index].y}%` }}
            >
              <button
                type="button"
                className="chart-dot"
                aria-label={`${monthNameOnly(point.month)}: ${formatCzk(point.result, { sign: true })}`}
                onMouseEnter={() => setOpen(point.month)}
                onClick={() => setOpen(isOpen ? null : point.month)}
              />

              {isOpen ? (
                <div className="chart-tip fade">
                  <p className="chart-tip-title">{monthNameOnly(point.month)}</p>
                  <p>
                    {point.kind === "actual" ? "příjmy" : "plánované příjmy"}{" "}
                    <b className="num pos">{formatCzk(point.income, { sign: true })}</b>
                  </p>
                  <p>
                    {point.kind === "actual" ? "výdaje" : "plánované výdaje"}{" "}
                    <b className="num neg">{formatCzk(-point.expenses)}</b>
                  </p>
                  <p className="chart-tip-total">
                    {point.kind === "actual" ? "výsledek měsíce" : "předpokládaný výsledek"}{" "}
                    <b className={`num ${point.result < 0 ? "neg" : "pos"}`}>
                      {formatCzk(point.result, { sign: true })}
                    </b>
                  </p>
                </div>
              ) : (
                <span className={`chart-value ${point.result < 0 ? "neg" : "pos"}`}>
                  {formatCzk(point.result, { sign: true, unit: false })}
                </span>
              )}
            </div>
          );
        })}

        {scale.ticks.map((tick) => (
          <span
            key={tick}
            className={`chart-y${tick === 0 ? " is-zero" : ""}`}
            style={{ top: `${100 - scale.percentOf(tick)}%` }}
          >
            {formatCompact(tick)}
          </span>
        ))}
      </div>

      <div className="chart-x">
        {points.map((point, index) => (
          <span key={point.month} style={{ left: `${at(index)}%` }}>
            {monthNameOnly(point.month)}
          </span>
        ))}
      </div>
    </div>
  );
}
