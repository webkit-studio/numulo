import { isInMonth, type IsoMonth } from "@/lib/date";
import type { CalcPlannedItem, CalcTransaction } from "./types";

/**
 * The two exclusion flags, in one place.
 *
 * `isBusiness` — OSVČ money passing through the household accounts. Excluded
 * from every household total so business turnover can't dirty the averages.
 *
 * `isTransfer` — a move between two tracked accounts (Air Bank ↔ Revolut).
 * Excluded from income and expense metrics, otherwise one move would show up
 * as income and expense at the same time.
 *
 * Rezerva is the documented exception: it counts everything, because it is
 * the position of the tracked accounts. A transfer between two tracked
 * accounts nets to zero there on its own, and money leaving for an untracked
 * account correctly lowers it.
 */

/** Spending that counts towards the household: not business, not a transfer. */
export function isHouseholdSpending(tx: CalcTransaction): boolean {
  return tx.amount < 0 && !tx.isBusiness && !tx.isTransfer;
}

/**
 * Money that actually landed. Transfers are excluded; business income is not,
 * because for an OSVČ household that is exactly the money funding the month.
 */
export function isIncoming(tx: CalcTransaction): boolean {
  return tx.amount > 0 && !tx.isTransfer;
}

/** Positive total of household spending in a month. */
export function householdSpendingIn(
  transactions: readonly CalcTransaction[],
  month: IsoMonth,
): number {
  return transactions.reduce(
    (sum, tx) =>
      isHouseholdSpending(tx) && isInMonth(tx.date, month)
        ? sum - tx.amount
        : sum,
    0,
  );
}

/** Positive total of money that arrived in a month. */
export function incomingIn(
  transactions: readonly CalcTransaction[],
  month: IsoMonth,
): number {
  return transactions.reduce(
    (sum, tx) =>
      isIncoming(tx) && isInMonth(tx.date, month) ? sum + tx.amount : sum,
    0,
  );
}

/** Does a planned item load this particular month? */
export function plannedItemApplies(
  item: CalcPlannedItem,
  month: IsoMonth,
): boolean {
  if (item.active === false) return false;
  // A one-off has a mandatory month and burdens only that one; a monthly item
  // applies to every month.
  return item.interval === "monthly" || item.month === month;
}

export function plannedTotal(
  items: readonly CalcPlannedItem[],
  month: IsoMonth,
  direction: "income" | "expense",
): number {
  return items.reduce(
    (sum, item) =>
      item.direction === direction && plannedItemApplies(item, month)
        ? sum + item.amount
        : sum,
    0,
  );
}
