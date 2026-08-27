"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { monthLabel } from "@/lib/date";

/** The month pill top right. Empty list means the household has no data yet. */
export function MonthPicker({
  months,
  current,
  dayNote,
}: {
  months: string[];
  current: string;
  dayNote?: string;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [open, setOpen] = useState(false);

  return (
    <div className="month-picker">
      <button
        type="button"
        className="month-pill"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        disabled={months.length <= 1}
      >
        <span>{monthLabel(current)}</span>
        {dayNote ? <span className="month-day">{dayNote}</span> : null}
      </button>

      {open ? (
        <>
          <button
            type="button"
            className="overlay"
            aria-label="Zavřít"
            onClick={() => setOpen(false)}
          />
          <div className="month-menu fade" role="listbox">
            {months.map((month) => (
              <button
                key={month}
                type="button"
                role="option"
                aria-selected={month === current}
                className={`month-option${month === current ? " is-active" : ""}`}
                onClick={() => {
                  const next = new URLSearchParams(params);
                  next.set("mesic", month);
                  router.push(`?${next.toString()}`);
                  setOpen(false);
                }}
              >
                {monthLabel(month)}
                {month === current ? <span aria-hidden="true">✓</span> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
