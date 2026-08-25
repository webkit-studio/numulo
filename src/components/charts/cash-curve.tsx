"use client";

import { useState } from "react";
import { buildScale, smoothPath } from "./scale";
import { monthNameOnly } from "@/lib/date";
import { formatCompact, formatCzk } from "@/lib/money";
import type { CashPoint } from "@/lib/calc";

/**
 * Cash over time: what is actually on the accounts.
 *
 * The sibling of the cashflow chart and a different question — cashflow says
 * what a month earned, this says whether the money is there on the day the
 * direct debit lands. A month below zero is drawn red and named in a sentence
 * above the chart, because the whole reason to plot a forecast is to catch
 * that month while there is still time to move something.
 */
export function CashCurve({
  points,
  cashToday,
}: {
  points: CashPoint[];
  cashToday: number;
}) {
  const [open, setOpen] = useState<string | null>(null);

  if (points.length === 0) return <p className="empty">–</p>;

  const scale = buildScale(points.map((point) => point.cash));
  const anyNegative = points.some((point) => point.belowZero);

  const at = (index: number) => (points.length === 1 ? 50 : (index / (points.length - 1)) * 100);
  const coords = points.map((point, index) => ({
    x: at(index),
    y: 100 - scale.percentOf(point.cash),
  }));

  const lastActual = points.reduce(
    (best, point, index) => (point.kind === "actual" ? index : best),
    0,
  );

  return (
    <div className="chart chart-curve" onMouseLeave={() => setOpen(null)}>
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

          {/* Two paths so the forecast can be drawn in its own ink. */}
          <path
            d={smoothPath(coords.slice(0, lastActual + 1))}
            className="chart-line"
            vectorEffect="non-scaling-stroke"
          />
          <path
            d={smoothPath(coords.slice(lastActual))}
            className="chart-line is-forecast"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {points.map((point, index) => {
          const isOpen = open === point.month;
          const isToday = index === lastActual;

          return (
            <div
              key={point.month}
              className={`chart-point kind-${point.kind}${point.belowZero ? " is-below" : ""}${isOpen ? " is-open" : ""}`}
              style={{ left: `${coords[index].x}%`, top: `${coords[index].y}%` }}
            >
              <button
                type="button"
                className="chart-dot"
                aria-label={`${monthNameOnly(point.month)}: ${formatCzk(point.cash)}`}
                onMouseEnter={() => setOpen(point.month)}
                onClick={() => setOpen(isOpen ? null : point.month)}
              />

              {isOpen ? (
                <div className="chart-tip fade">
                  <p className="chart-tip-title">{monthNameOnly(point.month)}</p>
                  <p className="chart-tip-total">
                    {isToday ? "na účtech dnes" : point.kind === "actual" ? "hotovost na konci" : "hotovost na konci"}{" "}
                    <b className={`num ${point.cash < 0 ? "neg" : "pos"}`}>{formatCzk(point.cash)}</b>
                  </p>
                </div>
              ) : (
                <span className={`chart-value ${point.cash < 0 ? "neg" : "pos"}`}>
                  {/* The real balance, not a rounded one — "5,4 k" is not an
                      answer to "will the direct debit clear". */}
                  {formatCzk(point.cash, { unit: false })}
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

      <p className="chart-foot">na účtech dnes <b className="num">{formatCzk(cashToday)}</b></p>
    </div>
  );
}
