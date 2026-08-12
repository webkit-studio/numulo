import { describe, expect, it } from "vitest";
import { czkToHalere as czk } from "@/lib/money";
import {
  actualMonth,
  averageVariableSpending,
  cashOverTime,
  computeMonthlyGoal,
  computeReserve,
  estimatePayoff,
  forecastMonth,
  householdSpendingIn,
  incomingIn,
  summariseDebts,
  variableSpendingByMonth,
  type CalcDebt,
  type CalcTransaction,
} from "./index";

/* ------------------------------------------------------------- fixtures */

const tx = (
  date: string,
  amountCzk: number,
  flags: Partial<Pick<CalcTransaction, "isBusiness" | "isTransfer">> = {},
): CalcTransaction => ({
  date,
  amount: czk(amountCzk),
  isBusiness: flags.isBusiness ?? false,
  isTransfer: flags.isTransfer ?? false,
});

const debt = (
  remainingCzk: number,
  instalmentCzk: number,
  active = true,
): CalcDebt => ({
  remainingAmount: czk(remainingCzk),
  installmentAmount: czk(instalmentCzk),
  active,
});

const MONTHLY_BUDGET = czk(63_000);

/* --------------------------------------------------------------- filters */

describe("business and transfer exclusion", () => {
  const transactions = [
    tx("2026-08-03", -1_200),
    tx("2026-08-05", -8_000, { isBusiness: true }),
    tx("2026-08-07", -5_000, { isTransfer: true }),
    tx("2026-08-09", -800),
    tx("2026-08-11", 40_000),
    tx("2026-08-12", 25_000, { isBusiness: true }),
    tx("2026-08-13", 5_000, { isTransfer: true }),
    tx("2026-07-30", -9_999),
  ];

  it("keeps business and transfers out of household spending", () => {
    expect(householdSpendingIn(transactions, "2026-08")).toBe(czk(2_000));
  });

  it("counts business income but not transfers as money that arrived", () => {
    expect(incomingIn(transactions, "2026-08")).toBe(czk(65_000));
  });

  it("does not leak across month boundaries", () => {
    expect(householdSpendingIn(transactions, "2026-07")).toBe(czk(9_999));
  });
});

/* --------------------------------------------------------------- rezerva */

describe("Rezerva", () => {
  const base = {
    initialBalance: czk(20_000),
    initialBalanceDate: "2026-07-31",
  };

  it("is cash minus debts, and may be negative", () => {
    const result = computeReserve({
      ...base,
      transactions: [tx("2026-08-02", -5_000), tx("2026-08-06", 12_000)],
      debts: [debt(180_000, 6_000), debt(40_000, 2_000)],
    });

    expect(result.cash).toBe(czk(27_000));
    expect(result.debts).toBe(czk(220_000));
    expect(result.reserve).toBe(czk(-193_000));
  });

  it("counts business and transfers — it is an account position, not a metric", () => {
    const result = computeReserve({
      ...base,
      transactions: [
        tx("2026-08-02", -30_000, { isBusiness: true }),
        tx("2026-08-03", 50_000, { isBusiness: true }),
      ],
      debts: [],
    });

    expect(result.cash).toBe(czk(40_000));
  });

  it("nets a transfer between two tracked accounts to zero on its own", () => {
    const withoutTransfer = computeReserve({
      ...base,
      transactions: [tx("2026-08-02", -1_000)],
      debts: [],
    });
    const withTransfer = computeReserve({
      ...base,
      transactions: [
        tx("2026-08-02", -1_000),
        tx("2026-08-04", -7_000, { isTransfer: true }),
        tx("2026-08-04", 7_000, { isTransfer: true }),
      ],
      debts: [],
    });

    expect(withTransfer.reserve).toBe(withoutTransfer.reserve);
  });

  it("ignores history at or before the cut-off date", () => {
    const result = computeReserve({
      ...base,
      transactions: [
        tx("2026-01-15", -400_000), // seven months of seeded history
        tx("2026-07-31", -50_000), // the cut-off day itself
        tx("2026-08-01", -1_000), // the first real day
      ],
      debts: [],
    });

    expect(result.cash).toBe(czk(19_000));
  });

  it("counts every transaction when no cut-off is configured yet", () => {
    const result = computeReserve({
      initialBalance: 0,
      initialBalanceDate: null,
      transactions: [tx("2026-01-15", -1_000), tx("2026-08-01", 3_000)],
      debts: [],
    });

    expect(result.cash).toBe(czk(2_000));
  });

  it("leaves Rezerva unchanged when an instalment is paid", () => {
    const before = computeReserve({
      ...base,
      transactions: [],
      debts: [debt(180_000, 6_000)],
    });
    const after = computeReserve({
      ...base,
      transactions: [tx("2026-08-15", -6_000)],
      debts: [debt(174_000, 6_000)],
    });

    expect(after.reserve).toBe(before.reserve);
  });

  it("skips debts that are no longer active", () => {
    const result = computeReserve({
      ...base,
      transactions: [],
      debts: [debt(180_000, 6_000), debt(99_000, 3_000, false)],
    });

    expect(result.debts).toBe(czk(180_000));
  });
});

/* ----------------------------------------------------------- cíl měsíce */

describe("Cíl měsíce", () => {
  const debts = [debt(180_000, 6_000), debt(40_000, 2_000)];

  it("raises the goal by the instalments on top of the budget", () => {
    const goal = computeMonthlyGoal({
      month: "2026-08",
      monthlyBudget: MONTHLY_BUDGET,
      debts,
      transactions: [],
      plannedItems: [],
    });

    expect(goal.needed).toBe(czk(71_000));
    expect(goal.neededBreakdown).toEqual({
      budget: czk(63_000),
      debtInstalments: czk(8_000),
    });
  });

  it("subtracts what arrived and what is on the way", () => {
    const goal = computeMonthlyGoal({
      month: "2026-08",
      monthlyBudget: MONTHLY_BUDGET,
      debts,
      transactions: [
        tx("2026-08-05", 30_000),
        tx("2026-08-08", 15_000, { isBusiness: true }),
        tx("2026-08-09", 9_000, { isTransfer: true }),
      ],
      plannedItems: [
        {
          amount: czk(20_000),
          direction: "income",
          interval: "once",
          month: "2026-08",
        },
      ],
    });

    expect(goal.received).toBe(czk(45_000));
    expect(goal.onTheWay).toBe(czk(20_000));
    expect(goal.missing).toBe(czk(6_000));
    expect(goal.covered).toBe(false);
  });

  it("reports the surplus once the goal is covered", () => {
    const goal = computeMonthlyGoal({
      month: "2026-08",
      monthlyBudget: MONTHLY_BUDGET,
      debts,
      transactions: [tx("2026-08-05", 80_000)],
      plannedItems: [],
    });

    expect(goal.covered).toBe(true);
    expect(goal.extra).toBe(czk(9_000));
  });

  it("burdens a one-off planned item only in its own month", () => {
    const item = {
      amount: czk(20_000),
      direction: "income" as const,
      interval: "once" as const,
      month: "2026-08",
    };

    expect(
      computeMonthlyGoal({
        month: "2026-09",
        monthlyBudget: MONTHLY_BUDGET,
        debts: [],
        transactions: [],
        plannedItems: [item],
      }).onTheWay,
    ).toBe(0);
  });

  it("applies a monthly planned item to every month", () => {
    const item = {
      amount: czk(12_000),
      direction: "income" as const,
      interval: "monthly" as const,
    };

    for (const month of ["2026-08", "2026-09", "2026-10"]) {
      expect(
        computeMonthlyGoal({
          month,
          monthlyBudget: MONTHLY_BUDGET,
          debts: [],
          transactions: [],
          plannedItems: [item],
        }).onTheWay,
      ).toBe(czk(12_000));
    }
  });
});

/* --------------------------------------------------------------- cashflow */

describe("cashflow", () => {
  const forecastBase = {
    month: "2026-09",
    monthlyBudget: MONTHLY_BUDGET,
    debts: [debt(180_000, 6_000)],
    recurringMonthly: [{ amount: czk(18_000) }, { amount: czk(2_500) }],
    subscriptions: [{ amount: czk(300) }, { amount: czk(200) }],
    recurringYearly: [
      { amount: czk(9_000), dueMonth: 9 },
      { amount: czk(4_000), dueMonth: 3 },
    ],
    plannedItems: [
      {
        amount: czk(15_000),
        direction: "expense" as const,
        interval: "once" as const,
        month: "2026-09",
      },
    ],
    variableAverage: czk(21_000),
  };

  it("computes both sides of the forecast", () => {
    const forecast = forecastMonth(forecastBase);

    // 63 000 budget + 6 000 instalment + 0 planned income
    expect(forecast.income).toBe(czk(69_000));
    // 20 500 recurring + 500 subs + 9 000 yearly + 6 000 instalment
    // + 15 000 planned + 21 000 variable
    expect(forecast.expenses).toBe(czk(72_000));
    expect(forecast.result).toBe(czk(-3_000));
  });

  it("only charges a yearly item in its due month", () => {
    expect(forecastMonth({ ...forecastBase, month: "2026-10" }).breakdown.yearlyDue).toBe(0);
  });

  it("keeps debt instalments neutral to the month's result", () => {
    const withDebt = forecastMonth(forecastBase);
    const withoutDebt = forecastMonth({ ...forecastBase, debts: [] });

    expect(withDebt.result).toBe(withoutDebt.result);
    expect(withDebt.income - withoutDebt.income).toBe(czk(6_000));
    expect(withDebt.expenses - withoutDebt.expenses).toBe(czk(6_000));
  });

  it("reads a completed month straight from the transactions", () => {
    const result = actualMonth(
      [
        tx("2026-07-05", 55_000),
        tx("2026-07-06", 10_000, { isBusiness: true }),
        tx("2026-07-07", 4_000, { isTransfer: true }),
        tx("2026-07-10", -12_000),
        tx("2026-07-11", -3_000, { isBusiness: true }),
        tx("2026-07-12", -4_000, { isTransfer: true }),
      ],
      "2026-07",
    );

    expect(result.income).toBe(czk(65_000));
    expect(result.expenses).toBe(czk(12_000));
    expect(result.result).toBe(czk(53_000));
    expect(result.kind).toBe("actual");
  });

  it("averages variable spending over months that have data", () => {
    const byMonth = variableSpendingByMonth([
      tx("2026-06-04", -20_000),
      tx("2026-07-04", -24_000),
      tx("2026-08-04", -100_000), // the current month must not count
    ]);

    expect(averageVariableSpending(byMonth, "2026-08", 6)).toBe(czk(22_000));
  });

  it("returns zero when there is no history to average", () => {
    expect(averageVariableSpending(new Map(), "2026-08")).toBe(0);
  });

  it("excludes recognised recurring spending from the variable average", () => {
    const rent = tx("2026-07-01", -18_000);
    const byMonth = variableSpendingByMonth(
      [rent, tx("2026-07-04", -6_000)],
      (candidate) => candidate === rent,
    );

    expect(byMonth.get("2026-07")).toBe(czk(6_000));
  });
});

/* --------------------------------------------------------- cash over time */

describe("hotovost v čase", () => {
  it("walks actuals then continues with the forecast", () => {
    const points = cashOverTime({
      initialBalance: czk(30_000),
      initialBalanceDate: "2026-06-30",
      transactions: [
        tx("2026-06-15", -900_000), // history, before the cut-off
        tx("2026-07-10", -10_000),
        tx("2026-08-10", -5_000),
      ],
      months: ["2026-07", "2026-08", "2026-09", "2026-10"],
      currentMonth: "2026-09",
      forecastResultByMonth: new Map([
        ["2026-09", czk(-8_000)],
        ["2026-10", czk(-12_000)],
      ]),
    });

    expect(points.map((point) => point.cash)).toEqual([
      czk(20_000),
      czk(15_000),
      czk(7_000),
      czk(-5_000),
    ]);
    expect(points.map((point) => point.kind)).toEqual([
      "actual",
      "actual",
      "forecast",
      "forecast",
    ]);
  });

  it("flags the month where cash is projected to run out", () => {
    const points = cashOverTime({
      initialBalance: czk(5_000),
      initialBalanceDate: "2026-07-31",
      transactions: [],
      months: ["2026-08", "2026-09"],
      currentMonth: "2026-08",
      forecastResultByMonth: new Map([
        ["2026-08", czk(-2_000)],
        ["2026-09", czk(-9_000)],
      ]),
    });

    expect(points.map((point) => point.belowZero)).toEqual([false, true]);
  });
});

/* ------------------------------------------------------------------ dluhy */

describe("odhad splacení", () => {
  it("rounds the last part-instalment up to a whole month", () => {
    expect(estimatePayoff(debt(20_000, 6_000), "2026-08")).toEqual({
      months: 4,
      cleanBy: "2026-11",
    });
  });

  it("clears in the current month when one instalment covers the rest", () => {
    expect(estimatePayoff(debt(6_000, 6_000), "2026-08")).toEqual({
      months: 1,
      cleanBy: "2026-08",
    });
  });

  it("gives no estimate when there is no instalment", () => {
    expect(estimatePayoff(debt(20_000, 0), "2026-08")).toEqual({
      months: null,
      cleanBy: null,
    });
  });

  it("takes the summary's clean date from the longest-living debt", () => {
    const summary = summariseDebts(
      [debt(180_000, 6_000), debt(40_000, 2_000), debt(500_000, 1_000, false)],
      "2026-08",
    );

    expect(summary.totalOwed).toBe(czk(220_000));
    expect(summary.monthlyInstalments).toBe(czk(8_000));
    // 30 instalments on the first debt, 20 on the second.
    expect(summary.cleanBy).toBe("2029-01");
  });

  it("shortens the estimate after an extra payment", () => {
    const before = estimatePayoff(debt(20_000, 6_000), "2026-08");
    const after = estimatePayoff(debt(8_000, 6_000), "2026-08");

    expect(before.months).toBe(4);
    expect(after.months).toBe(2);
  });
});
