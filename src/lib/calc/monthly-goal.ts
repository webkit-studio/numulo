import type { IsoMonth } from "@/lib/date";
import { incomingIn, plannedTotal } from "./filters";
import type { CalcDebt, CalcPlannedItem, CalcTransaction } from "./types";

export interface MonthlyGoalInput {
  month: IsoMonth;
  /** The household spending ceiling. Not a payout, not income. */
  monthlyBudget: number;
  debts: readonly CalcDebt[];
  transactions: readonly CalcTransaction[];
  plannedItems: readonly CalcPlannedItem[];
}

export interface MonthlyGoal {
  /** monthlyBudget + instalments on active debts. */
  needed: number;
  /** Broken out for the ⓘ tooltip. */
  neededBreakdown: { budget: number; debtInstalments: number };
  /** Actually credited this month. */
  received: number;
  /** Planned income for this month. */
  onTheWay: number;
  /** needed − received − onTheWay. Zero or less means covered. */
  missing: number;
  covered: boolean;
  /** How much lands above the goal once it is covered. */
  extra: number;
}

/**
 * Cíl měsíce — how much has to be earned this month.
 *
 * The instalments are added on top of the household budget on purpose: that is
 * what makes the debts get paid out of extra earnings rather than out of the
 * family's spending money. Levies paid as ordinary recurring items are already
 * in `recurring_monthly` — they must not be counted a second time here.
 */
export function computeMonthlyGoal(input: MonthlyGoalInput): MonthlyGoal {
  const debtInstalments = input.debts.reduce(
    (sum, debt) => (debt.active ? sum + debt.installmentAmount : sum),
    0,
  );

  const needed = input.monthlyBudget + debtInstalments;
  const received = incomingIn(input.transactions, input.month);
  const onTheWay = plannedTotal(input.plannedItems, input.month, "income");
  const missing = needed - received - onTheWay;

  return {
    needed,
    neededBreakdown: { budget: input.monthlyBudget, debtInstalments },
    received,
    onTheWay,
    missing,
    covered: missing <= 0,
    extra: missing < 0 ? -missing : 0,
  };
}
