import {
  addMonths,
  isInMonth,
  monthNumber,
  monthOf,
  type IsoDate,
  type IsoMonth,
} from "@/lib/date";
import { isHouseholdSpending, isIncoming, plannedTotal } from "./filters";
import type {
  CalcDebt,
  CalcPlannedItem,
  CalcRecurringMonthly,
  CalcRecurringYearly,
  CalcSubscription,
  CalcTransaction,
} from "./types";

export interface MonthResult {
  month: IsoMonth;
  income: number;
  expenses: number;
  /** income − expenses. */
  result: number;
  kind: "actual" | "forecast";
}

/* ---------------------------------------------------------------- actuals */

/**
 * A completed month, straight from the transactions.
 *
 * Expenses exclude business (an expense aggregation) and transfers. Income
 * excludes transfers but keeps business, matching "přišlo" in Cíl měsíce —
 * for an OSVČ household that invoice money is what funds the month.
 */
export function actualMonth(
  transactions: readonly CalcTransaction[],
  month: IsoMonth,
): MonthResult {
  let income = 0;
  let expenses = 0;

  for (const tx of transactions) {
    if (!isInMonth(tx.date, month)) continue;
    if (isIncoming(tx)) income += tx.amount;
    else if (isHouseholdSpending(tx)) expenses -= tx.amount;
  }

  return { month, income, expenses, result: income - expenses, kind: "actual" };
}

/* --------------------------------------------------- variable spending avg */

/**
 * Household spending per month, minus anything the caller recognises as a
 * recurring item or a subscription — those are forecast from their own tables,
 * so counting them here too would double them.
 */
export function variableSpendingByMonth(
  transactions: readonly CalcTransaction[],
  isRecurring: (tx: CalcTransaction) => boolean = () => false,
): Map<IsoMonth, number> {
  const byMonth = new Map<IsoMonth, number>();
  for (const tx of transactions) {
    if (!isHouseholdSpending(tx) || isRecurring(tx)) continue;
    const month = monthOf(tx.date);
    byMonth.set(month, (byMonth.get(month) ?? 0) - tx.amount);
  }
  return byMonth;
}

/**
 * Mean variable spending over the `count` months before `month`.
 *
 * Averages only over months that actually have data. A household with three
 * months of history would otherwise be averaged against three zero months and
 * told it spends half what it does.
 */
export function averageVariableSpending(
  byMonth: ReadonlyMap<IsoMonth, number>,
  month: IsoMonth,
  count = 6,
): number {
  let total = 0;
  let seen = 0;
  for (let i = 1; i <= count; i++) {
    const value = byMonth.get(addMonths(month, -i));
    if (value === undefined) continue;
    total += value;
    seen += 1;
  }
  return seen === 0 ? 0 : Math.round(total / seen);
}

/* --------------------------------------------------------------- forecast */

export interface ForecastInput {
  month: IsoMonth;
  monthlyBudget: number;
  debts: readonly CalcDebt[];
  recurringMonthly: readonly CalcRecurringMonthly[];
  subscriptions: readonly CalcSubscription[];
  recurringYearly: readonly CalcRecurringYearly[];
  plannedItems: readonly CalcPlannedItem[];
  /** 6-month mean of variable spending, from `averageVariableSpending`. */
  variableAverage: number;
}

export interface Forecast extends MonthResult {
  breakdown: {
    budget: number;
    debtInstalments: number;
    plannedIncome: number;
    recurringMonthly: number;
    subscriptions: number;
    yearlyDue: number;
    plannedExpenses: number;
    variableAverage: number;
  };
}

const sumActive = (
  items: readonly { amount: number; active?: boolean }[],
): number =>
  items.reduce((sum, item) => (item.active === false ? sum : sum + item.amount), 0);

/**
 * The current and future months of the cashflow chart, and the single number
 * Plán shows as "výsledek měsíce podle plánu".
 *
 * Debt instalments sit on both sides on purpose: the raised goal earns them,
 * so they are neutral to the month's result and never eat the household
 * budget.
 */
export function forecastMonth(input: ForecastInput): Forecast {
  const debtInstalments = input.debts.reduce(
    (sum, debt) => (debt.active ? sum + debt.installmentAmount : sum),
    0,
  );

  const plannedIncome = plannedTotal(input.plannedItems, input.month, "income");
  const plannedExpenses = plannedTotal(
    input.plannedItems,
    input.month,
    "expense",
  );
  const recurringMonthly = sumActive(input.recurringMonthly);
  const subscriptions = sumActive(input.subscriptions);
  const yearlyDue = input.recurringYearly.reduce(
    (sum, item) =>
      item.active !== false && item.dueMonth === monthNumber(input.month)
        ? sum + item.amount
        : sum,
    0,
  );

  const income = input.monthlyBudget + debtInstalments + plannedIncome;
  const expenses =
    recurringMonthly +
    subscriptions +
    yearlyDue +
    debtInstalments +
    plannedExpenses +
    input.variableAverage;

  return {
    month: input.month,
    income,
    expenses,
    result: income - expenses,
    kind: "forecast",
    breakdown: {
      budget: input.monthlyBudget,
      debtInstalments,
      plannedIncome,
      recurringMonthly,
      subscriptions,
      yearlyDue,
      plannedExpenses,
      variableAverage: input.variableAverage,
    },
  };
}

/* --------------------------------------------------------- cash over time */

export interface CashPoint {
  month: IsoMonth;
  /** Cash on the tracked accounts at the end of the month. */
  cash: number;
  kind: "actual" | "forecast";
  /** Highlight the month and warn: cash is projected to run out. */
  belowZero: boolean;
}

export interface CashOverTimeInput {
  initialBalance: number;
  initialBalanceDate: IsoDate | null;
  transactions: readonly CalcTransaction[];
  /** Oldest first. Months up to and including `currentMonth` are actuals. */
  months: readonly IsoMonth[];
  currentMonth: IsoMonth;
  /** Forecast result per month, for the current month and every month after. */
  forecastResultByMonth: ReadonlyMap<IsoMonth, number>;
}

/**
 * Hotovost v čase. Past points are the real cumulative account position;
 * future points add each month's forecast result to the one before.
 */
export function cashOverTime(input: CashOverTimeInput): CashPoint[] {
  const cutoff = input.initialBalanceDate;
  const points: CashPoint[] = [];
  let running = input.initialBalance;

  // Transactions that predate the cut-off are history — they feed averages and
  // trends, never the account position.
  const counted = input.transactions.filter(
    (tx) => cutoff === null || tx.date > cutoff,
  );

  for (const month of input.months) {
    if (month < input.currentMonth) {
      running += counted.reduce(
        (sum, tx) => (isInMonth(tx.date, month) ? sum + tx.amount : sum),
        0,
      );
      points.push({
        month,
        cash: running,
        kind: "actual",
        belowZero: running < 0,
      });
    } else {
      running += input.forecastResultByMonth.get(month) ?? 0;
      points.push({
        month,
        cash: running,
        kind: "forecast",
        belowZero: running < 0,
      });
    }
  }

  return points;
}
