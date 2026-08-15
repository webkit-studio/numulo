"use client";

import { useState } from "react";
import { simulateCancellation } from "@/lib/recurring/detect";
import { formatCzk } from "@/lib/money";

/**
 * "Co když tohle zrušíme" — ticking items shows what stops leaving the account.
 *
 * Nothing is saved. The point is to see the yearly number, which is the one
 * that changes minds: 249 Kč a month is invisible, 2 988 Kč a year is not.
 */
export function CancelSimulator({
  items,
}: {
  items: { id: number; name: string; amount: number }[];
}) {
  const [selected, setSelected] = useState<number[]>([]);
  const freed = simulateCancellation(items, selected);

  if (items.length === 0) return null;

  return (
    <div className="cancel-sim">
      <ul className="chips">
        {items.map((item) => {
          const on = selected.includes(item.id);
          return (
            <li key={item.id}>
              <button
                type="button"
                className={`chip${on ? " is-on" : ""}`}
                aria-pressed={on}
                onClick={() =>
                  setSelected((current) =>
                    on
                      ? current.filter((id) => id !== item.id)
                      : [...current, item.id],
                  )
                }
              >
                {item.name} · {formatCzk(item.amount)}
              </button>
            </li>
          );
        })}
      </ul>

      <p className="cancel-result">
        {selected.length === 0 ? (
          <span className="seed-hint">
            Klikni na to, co zvažuješ zrušit — spočítám, kolik to dělá za rok.
          </span>
        ) : (
          <>
            Zrušením {selected.length}{" "}
            {selected.length === 1 ? "položky" : "položek"} ušetříš{" "}
            <strong className="numo-numeric">{formatCzk(freed.monthly)}</strong>{" "}
            měsíčně, tedy{" "}
            <strong className="numo-numeric">{formatCzk(freed.yearly)}</strong>{" "}
            za rok.
          </>
        )}
      </p>
    </div>
  );
}
