import type { IsoDate } from "@/lib/date";
import type { CalcDebt, CalcTransaction } from "./types";

export interface ReserveInput {
  /** Cash on the tracked accounts on `initialBalanceDate`. May be negative. */
  initialBalance: number;
  /**
   * The cut-off. Only transactions dated strictly after it move Rezerva —
   * everything on or before it is the historical seed, which feeds averages
   * and trends but must not be counted into today's position.
   * `null` means no cut-off is configured yet: every transaction counts.
   */
  initialBalanceDate: IsoDate | null;
  transactions: readonly CalcTransaction[];
  debts: readonly CalcDebt[];
}

export interface Reserve {
  /** Money actually on the tracked accounts right now. */
  cash: number;
  /** What is still owed on active debts. */
  debts: number;
  /** cash − debts. Negative is a normal, honest result. */
  reserve: number;
}

/**
 * Rezerva — the household's financial position, and numo's main existential
 * number.
 *
 * Counts everything, business and transfers included: it is the position of
 * the tracked accounts, not a household-spending metric.
 *
 * Paying an instalment does not move Rezerva — cash and debt fall by the same
 * amount. What raises it is the month's goal earning the instalments on top of
 * the household budget.
 */
export function computeReserve(input: ReserveInput): Reserve {
  const cutoff = input.initialBalanceDate;

  const cash = input.transactions.reduce(
    (sum, tx) => (cutoff === null || tx.date > cutoff ? sum + tx.amount : sum),
    input.initialBalance,
  );

  const debts = input.debts.reduce(
    (sum, debt) => (debt.active ? sum + debt.remainingAmount : sum),
    0,
  );

  return { cash, debts, reserve: cash - debts };
}
