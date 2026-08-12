import type { IsoDate, IsoMonth } from "@/lib/date";

/**
 * Structural inputs for the calculations. Deliberately narrower than the
 * Drizzle row types: the maths is pure and testable without a database, and a
 * schema change can't silently alter a formula.
 *
 * All amounts are haléře. Transaction amounts are signed (expenses negative);
 * every other amount is positive and its direction comes from its field name.
 */

export interface CalcTransaction {
  date: IsoDate;
  amount: number;
  isBusiness: boolean;
  isTransfer: boolean;
  categoryId?: number | null;
}

export interface CalcDebt {
  remainingAmount: number;
  installmentAmount: number;
  active: boolean;
  creditor?: string;
}

export interface CalcPlannedItem {
  amount: number;
  direction: "income" | "expense";
  interval: "once" | "monthly";
  month?: IsoMonth | null;
  active?: boolean;
}

export interface CalcRecurringMonthly {
  amount: number;
  active?: boolean;
}

export interface CalcSubscription {
  amount: number;
  active?: boolean;
}

export interface CalcRecurringYearly {
  amount: number;
  /** 1–12 */
  dueMonth: number;
  active?: boolean;
}
