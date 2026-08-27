import { describe, expect, it } from "vitest";
import {
  average,
  cashOverTime,
  computeDailyLimit,
  computeEnvelope,
  computeMonthGoal,
  computeObligations,
  computePlanned,
  computeRemaining,
  computeReserve,
  computeSavings,
  computeSpending,
  estimatePayoff,
  monthResult,
  percentAgainstAverage,
  summariseDebts,
} from ".";

/**
 * Every figure here comes from the spec's demo month (October 2026, day 21 of
 * 30). The spec says the numbers must add up; these tests are how that claim
 * stays true — if a formula drifts, the demo it was written from stops
 * reconciling and the test says so.
 *
 * Amounts are in haléře, so the spec's crowns are ×100.
 */

const Kc = (crowns: number) => crowns * 100;

const OCTOBER = "2026-10";
const MONTHLY_BUDGET = Kc(63_000);

describe("výdaje", () => {
  it("adds October's transactions to the subscriptions", () => {
    // Spec §3.1: transactions total 39 210; §3.3: subscriptions 1 990.
    const transactions = [
      { date: "2026-10-01", amount: -Kc(39_210), isBusiness: false, isTransfer: false },
    ];
    expect(
      computeSpending({ month: OCTOBER, transactions, subscriptions: Kc(1_990) }),
    ).toBe(Kc(41_200));
  });

  it("drops anything marked business or transfer", () => {
    const transactions = [
      { date: "2026-10-05", amount: -Kc(1_000), isBusiness: false, isTransfer: false },
      { date: "2026-10-06", amount: -Kc(5_000), isBusiness: true, isTransfer: false },
      { date: "2026-10-07", amount: -Kc(9_000), isBusiness: false, isTransfer: true },
    ];
    expect(computeSpending({ month: OCTOBER, transactions, subscriptions: 0 })).toBe(Kc(1_000));
  });

  it("ignores other months", () => {
    const transactions = [
      { date: "2026-09-30", amount: -Kc(512), isBusiness: false, isTransfer: false },
      { date: "2026-10-01", amount: -Kc(640), isBusiness: false, isTransfer: false },
    ];
    expect(computeSpending({ month: OCTOBER, transactions, subscriptions: 0 })).toBe(Kc(640));
  });
});

describe("povinnosti a plánované", () => {
  it("reaches the spec's 11 900 from its three parts", () => {
    // §3.10: ČSSZ+VZP 9 026 and mobile tariffs 598 unpaid, dentist 2 276 expected.
    const obligations = computeObligations({
      unpaidMonthly: Kc(9_026) + Kc(598),
      unpaidSubscriptions: 0,
      expected: Kc(2_276),
    });
    expect(obligations).toBe(Kc(11_900));
  });

  it("adds this month's planned expenses to reach 13 100", () => {
    // §3.10: pottery course 1 200, monthly.
    expect(computePlanned(Kc(11_900), Kc(1_200))).toBe(Kc(13_100));
  });
});

describe("spoření", () => {
  it("takes a fixed amount as given", () => {
    expect(computeSavings({ mode: "amount", value: Kc(3_000) }, MONTHLY_BUDGET)).toBe(Kc(3_000));
  });

  it("reads a percentage against the budget", () => {
    // §5.2 offers 10 % as the alternative to 3 000 Kč — on 63 000 that is 6 300.
    expect(computeSavings({ mode: "percent", value: 10 }, MONTHLY_BUDGET)).toBe(Kc(6_300));
  });
});

describe("zbývá na útratu", () => {
  // The base is the month's income now, not a configured budget — a conscious
  // departure from the spec, whose demo household had a fixed 63 000. The
  // arithmetic is identical, so the spec's figures still pin it: feeding the
  // demo's 63 000 as income must yield the demo's 5 700.
  it("matches the spec's headline 5 700 when income equals the demo budget", () => {
    expect(
      computeRemaining({
        income: MONTHLY_BUDGET,
        spending: Kc(41_200),
        planned: Kc(13_100),
        savings: Kc(3_000),
      }),
    ).toBe(Kc(5_700));
  });

  it("goes negative when no income is recorded — the truth, not a bug", () => {
    expect(
      computeRemaining({ income: 0, spending: Kc(10_000), planned: 0, savings: 0 }),
    ).toBe(-Kc(10_000));
  });

  it("moves crown for crown when savings change", () => {
    const base = { income: MONTHLY_BUDGET, spending: Kc(41_200), planned: Kc(13_100) };
    const at3000 = computeRemaining({ ...base, savings: Kc(3_000) });
    const at5000 = computeRemaining({ ...base, savings: Kc(5_000) });
    expect(at3000 - at5000).toBe(Kc(2_000));
  });
});

describe("denní limit a projekce", () => {
  // The spec's demo month is "den 21 z 30". October 2026 actually has 31 days,
  // so the 30-day arithmetic is pinned against November, which really has 30.
  const NOVEMBER = "2026-11";
  const daily = computeDailyLimit({
    month: NOVEMBER,
    today: 21,
    remaining: Kc(5_700),
    savings: Kc(3_000),
    variableSpending: Kc(24_060),
  });

  it("leaves 9 days of 30 on day 21 — today is already spent", () => {
    expect(daily.daysLeft).toBe(9);
  });

  it("matches the spec's 633 Kč per day", () => {
    // 5 700 ÷ 9 = 633.
    expect(Math.round(daily.perDay / 100)).toBe(633);
  });

  it("matches the spec's pace of 1 146 Kč per day", () => {
    // 24 060 ÷ 21 elapsed days = 1 146.
    expect(Math.round(daily.pace / 100)).toBe(1_146);
  });

  it("says the pace will still spend about 10 310 Kč", () => {
    expect(Math.round(daily.willSpend / 100)).toBe(10_311);
  });

  it("projects the spec's −1 610 Kč landing", () => {
    // Against 8 700 (before savings), not 5 700 — see the note on the input.
    expect(Math.round(daily.projection / 100)).toBe(-1_611);
  });

  it("does not divide by zero on the last day of the month", () => {
    const last = computeDailyLimit({
      month: OCTOBER,
      today: 31,
      remaining: Kc(500),
      savings: 0,
      variableSpending: Kc(1_000),
    });
    expect(last.daysLeft).toBe(0);
    expect(Number.isFinite(last.perDay)).toBe(true);
  });
});

describe("rezerva", () => {
  it("is cash minus debts, and may be negative", () => {
    // §3.7: 3 600 − 42 000 = −38 400.
    expect(computeReserve(Kc(3_600), Kc(42_000)).reserve).toBe(-Kc(38_400));
  });
});

describe("cíl měsíce", () => {
  // Needed is the month's cost. The spec's 68 000 (budget + instalments)
  // becomes the cost fed in directly — the missing/covered arithmetic it
  // pins is unchanged.
  const goal = computeMonthGoal({
    monthCost: Kc(68_000),
    received: Kc(41_000),
    onTheWay: Kc(24_000),
  });

  it("needs what the month costs — 68 000", () => {
    expect(goal.needed).toBe(Kc(68_000));
  });

  it("is short by the spec's 3 000", () => {
    expect(goal.missing).toBe(Kc(3_000));
    expect(goal.covered).toBe(false);
  });

  it("reports the surplus once the goal is passed", () => {
    const covered = computeMonthGoal({
      monthCost: Kc(68_000),
      received: Kc(70_000),
      onTheWay: 0,
    });
    expect(covered.covered).toBe(true);
    expect(covered.extra).toBe(Kc(2_000));
  });
});

describe("obálky", () => {
  it("is 'v klidu' with room to spare", () => {
    // §4: Jídlo limit 11 000, spent 8 460 → 2 540 left, well over 20 %.
    const envelope = computeEnvelope(Kc(8_460), Kc(11_000));
    expect(envelope.remaining).toBe(Kc(2_540));
    expect(envelope.state).toBe("v klidu");
  });

  it("says 'dochází' under a fifth of the limit", () => {
    expect(computeEnvelope(Kc(9_000), Kc(11_000)).state).toBe("dochází");
  });

  it("says 'nad plánem' once it overflows", () => {
    // Zábava: limit 2 000, but the demo's own spend is 1 680 — push it over.
    const envelope = computeEnvelope(Kc(2_400), Kc(2_000));
    expect(envelope.state).toBe("nad plánem");
    expect(envelope.remaining).toBe(-Kc(400));
    expect(envelope.overPercent).toBeCloseTo(20, 5);
  });

  it("has no state at all without a limit", () => {
    const envelope = computeEnvelope(Kc(740), null);
    expect(envelope.state).toBeNull();
    expect(envelope.remaining).toBeNull();
  });
});

describe("dluhy", () => {
  const cssz = { remainingAmount: Kc(28_000), installmentAmount: Kc(3_000), active: true };
  const vzp = { remainingAmount: Kc(14_000), installmentAmount: Kc(2_000), active: true };

  it("clears ČSSZ in 10 months — July 2027", () => {
    expect(estimatePayoff(cssz, OCTOBER)).toEqual({ months: 10, cleanBy: "2027-07" });
  });

  it("clears VZP in 7 months — April 2027", () => {
    expect(estimatePayoff(vzp, OCTOBER)).toEqual({ months: 7, cleanBy: "2027-04" });
  });

  it("summarises to 42 000 owed, 5 000 a month, clean by the longest debt", () => {
    const summary = summariseDebts([cssz, vzp], OCTOBER);
    expect(summary.totalOwed).toBe(Kc(42_000));
    expect(summary.monthlyInstalments).toBe(Kc(5_000));
    // Explicitly the longest debt, not an average of the two.
    expect(summary.cleanBy).toBe("2027-07");
  });

  it("cannot estimate without an instalment", () => {
    expect(estimatePayoff({ ...cssz, installmentAmount: 0 }, OCTOBER).cleanBy).toBeNull();
  });
});

describe("cashflow a hotovost", () => {
  it("computes the month result as income minus expenses", () => {
    // §3.12, September: 58 200 − 51 300 = +6 900.
    expect(monthResult("2026-09", Kc(58_200), Kc(51_300), "actual").result).toBe(Kc(6_900));
  });

  it("walks the spec's cash curve, including November below zero", () => {
    const points = cashOverTime({
      cashToday: Kc(3_600),
      currentMonth: OCTOBER,
      past: [
        { month: "2026-07", cash: Kc(900) },
        { month: "2026-08", cash: Kc(1_800) },
        { month: "2026-09", cash: Kc(2_500) },
      ],
      future: [
        // §3.7: +4 900 result, 5 600 insurance + 4 300 tyres.
        { month: "2026-11", result: Kc(4_900), extraordinary: Kc(5_600) + Kc(4_300) },
        { month: "2026-12", result: Kc(7_500), extraordinary: 0 },
        { month: "2027-01", result: Kc(8_200), extraordinary: Kc(2_300) },
        { month: "2027-02", result: Kc(10_500), extraordinary: 0 },
      ],
    });

    const byMonth = Object.fromEntries(points.map((p) => [p.month, p.cash]));
    expect(byMonth["2026-10"]).toBe(Kc(3_600));
    expect(byMonth["2026-11"]).toBe(-Kc(1_400));
    expect(byMonth["2026-12"]).toBe(Kc(6_100));
    expect(byMonth["2027-01"]).toBe(Kc(12_000));
    expect(byMonth["2027-02"]).toBe(Kc(22_500));

    expect(points.find((p) => p.month === "2026-11")?.belowZero).toBe(true);
  });
});

describe("průměry a trendy", () => {
  it("averages the six-month series to the spec's figure", () => {
    // §3.9 Jídlo: the series must average to §3.8's 9 300.
    const series = [10_100, 8_600, 9_800, 9_200, 9_640, 8_460].map(Kc);
    expect(average(series)).toBe(Kc(9_300));
  });

  it("reports October against that average as −9 %", () => {
    expect(percentAgainstAverage(Kc(8_460), Kc(9_300))).toBe(-9);
  });

  it("reports Domácnost as +7 %", () => {
    const series = [5_400, 4_800, 5_600, 4_900, 4_930, 5_570].map(Kc);
    expect(average(series)).toBe(Kc(5_200));
    expect(percentAgainstAverage(Kc(5_570), Kc(5_200))).toBe(7);
  });

  it("reports Zábava's drop as −33 %", () => {
    const series = [2_700, 2_900, 2_600, 2_500, 2_620, 1_680].map(Kc);
    expect(average(series)).toBe(Kc(2_500));
    expect(percentAgainstAverage(Kc(1_680), Kc(2_500))).toBe(-33);
  });
});
