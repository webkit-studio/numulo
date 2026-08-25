"use client";

import Link from "next/link";
import { useState } from "react";
import { signOut } from "@/app/actions/auth";

/**
 * The household card at the foot of the sidebar, with the popover the spec
 * puts there: which account is active, and the way out.
 */
export function AccountCard({
  name,
  kind,
  viewerName,
}: {
  name: string;
  kind: "household" | "business";
  viewerName: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="account">
      {open ? (
        <>
          {/* Full-bleed catcher so a click anywhere else closes the popover. */}
          <button
            type="button"
            className="overlay"
            aria-label="Zavřít"
            onClick={() => setOpen(false)}
          />
          <div className="popover fade" role="menu">
            <span className="popover-head">{name}</span>
            <Link href="/nastaveni" className="popover-item" onClick={() => setOpen(false)}>
              Nastavení účtu
            </Link>
            <span className="popover-item is-locked" aria-disabled="true">
              Podnikatelský účet · připravujeme
            </span>
            <form action={signOut}>
              <button type="submit" className="popover-item">Odhlásit</button>
            </form>
          </div>
        </>
      ) : null}

      <button type="button" className="account-btn" onClick={() => setOpen((v) => !v)}>
        <span className="account-name">{name}</span>
        <span className="account-meta">
          {kind === "household" ? "osobní účet" : "podnikatelský"} · {viewerName}
        </span>
      </button>
    </div>
  );
}
