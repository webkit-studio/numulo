"use client";

import { useState } from "react";

/**
 * The ⓘ next to a number, explaining where it came from.
 *
 * Opens on hover *and* click: hover alone is unreachable on a touch screen,
 * and these explanations are exactly what someone reaches for on a phone.
 */
export function Info({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <span
      className="info"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        className="info-btn"
        aria-expanded={open}
        aria-label="Jak se to počítá"
        onClick={() => setOpen((v) => !v)}
      >
        ⓘ
      </button>
      {open ? <span className="info-panel fade">{children}</span> : null}
    </span>
  );
}
