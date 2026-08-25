import { addMonths, daysInMonth, type IsoMonth } from "@/lib/date";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Every number Numulo shows, in one file.
 *
 * These are the formulas from spec §4 and nothing else. They are pure: given
 * the same inputs they give the same answers, with no database, no clock and
 * no framework anywhere near them — which is what makes it possible to pin
 * each one to the demo figures in the spec and know the app agrees with the
 * document it was built from.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface CalcTransaction {
  date: string;
  /** Haléře, signed. Expenses negative. */
  amount: number;
  isBusiness: boolean;
  isTransfer: boolean;
  categoryId?: string | null;
}

/** A transaction marked business or transfer drops out of every total. */
export const countsForHousehold = (tx: CalcTransaction): boolean =>
  !tx.isBusiness && !tx.isTransfer;

const inMonth = (date: string, month: IsoMonth): boolean =>
  date.startsWith(month);

/* ─────────────────────────────────────────────────────────── výdaje ────── */

export interface SpendingInput {
  month: IsoMonth;
  transactions: readonly CalcTransaction[];
  /** Monthly total of active subscriptions. */
  subscriptions: number;
}

/**
 * výdaje = Σ transakcí měsíce (bez podnikání a převodů) + předplatná
 *
 * Subscriptions are added on top rather than counted from transactions: they
 * are charged across the month and some have not been taken yet, but the money
 * is already committed. Counting only what has landed would make the first of
 * the month look rich.
 */
export function computeSpending(input: SpendingInput): number {
  const fromTransactions = input.transactions.reduce(
    (sum, tx) =>
      inMonth(tx.date, input.month) && countsForHousehold(tx) && tx.amount < 0
        ? sum - tx.amount
        : sum,
    0,
  );
  return fromTransactions + input.subscriptions;
}

/* ────────────────────────────────────────────────────── povinnosti ────── */

export interface ObligationsInput {
  /** Unpaid recurring monthly payments this month. */
  unpaidMonthly: number;
  /** Unpaid subscriptions this month. */
  unpaidSubscriptions: number;
  /** One-off expected payments (the dentist top-up in the demo). */
  expected: number;
}

/** povinnosti = nezaplacené pravidelné + předplatná + očekávané */
export function computeObligations(input: ObligationsInput): number {
  return input.unpaidMonthly + input.unpaidSubscriptions + input.expected;
}

/** plánované = povinnosti + plánované výdaje měsíce z Plánu */
export function computePlanned(obligations: number, plannedExpenses: number): number {
  return obligations + plannedExpenses;
}

/* ───────────────────────────────────────────────── zbývá na útratu ────── */

export interface RemainingInput {
  monthlyBudget: number;
  spending: number;
  planned: number;
  savings: number;
}

/**
 * zbývá na útratu = rozpočet − výdaje − plánované − spoření
 *
 * The headline number. Savings is subtracted rather than treated as a leftover
 * on purpose: money you intend to keep is not money you may spend, and showing
 * it as spendable is how a savings target quietly never happens.
 */
export function computeRemaining(input: RemainingInput): number {
  return input.monthlyBudget - input.spending - input.planned - input.savings;
}

export interface SavingsSetting {
  mode: "amount" | "percent";
  /** Haléře when mode is 'amount', percent 0–100 when 'percent'. */
  value: number;
}

/** spoření = částka, nebo procento z rozpočtu */
export function computeSavings(setting: SavingsSetting, monthlyBudget: number): number {
  return setting.mode === "amount"
    ? Math.round(setting.value)
    : Math.round((monthlyBudget * setting.value) / 100);
}

/* ──────────────────────────────────────────── denní limit a projekce ──── */

export interface DailyLimitInput {
  month: IsoMonth;
  /** Day of the month "today" is on, 1-based. */
  today: number;
  /** zbývá na útratu — after savings. Drives the daily limit. */
  remaining: number;
  /**
   * The savings target, added back for the projection only.
   *
   * ── Why the projection ignores savings ──────────────────────────────────
   * Spec §4 gives `projekce = zbývá − (tempo × 9) → −1 610`, but 5 700 −
   * 10 314 is −4 614, not −1 610. The published figure reconciles against
   * 8 700 — the daily-limit tooltip's "Zbývá 8 700 − spoření 3 000 = 5 700" —
   * and 8 700 − 10 310 = −1 610 exactly, which is what the screenshot shows.
   *
   * So the projection asks "will the money last", and savings is a goal rather
   * than a bill. Overshooting eats into the savings first, and only then into
   * money that is not there. Reported to the client as a spec inconsistency.
   */
  savings: number;
  /** Household spending this month excluding the fixed recurring items. */
  variableSpending: number;
}

export interface DailyLimit {
  /** Days left, today excluded — today's spending already happened. */
  daysLeft: number;
  /** zbývá na útratu ÷ zbývající dny */
  perDay: number;
  /** variabilní výdaje ÷ uplynulé dny */
  pace: number;
  /** How much this pace would still spend before the month ends. */
  willSpend: number;
  /** Where the month lands at this pace. Negative means it overshoots. */
  projection: number;
}

/**
 * The daily limit, and the honest projection next to it.
 *
 * The projection exists because a daily limit on its own is easy to nod at and
 * ignore. Saying "at this rate you finish 1 610 Kč under" is the sentence that
 * actually changes what someone does this afternoon.
 */
export function computeDailyLimit(input: DailyLimitInput): DailyLimit {
  const total = daysInMonth(input.month);
  const elapsed = Math.max(1, Math.min(input.today, total));
  // The spec is explicit — "den 21 z 30, zbývá 9 dní": today's spending has
  // already happened and is in `variableSpending`, so counting today again as
  // a day left to spend would hand back money that is gone.
  const daysLeft = Math.max(0, total - elapsed);

  const perDay = daysLeft === 0 ? 0 : Math.round(input.remaining / daysLeft);
  const pace = Math.round(input.variableSpending / elapsed);
  const willSpend = pace * daysLeft;

  return {
    daysLeft,
    perDay,
    pace,
    willSpend,
    projection: input.remaining + input.savings - willSpend,
  };
}

/* ────────────────────────────────────────────────────────── rezerva ───── */

export interface Reserve {
  cash: number;
  debts: number;
  /** hotovost − dluhy. Legitimately negative. */
  reserve: number;
}

/** rezerva = hotovost − dluhy */
export function computeReserve(cash: number, debts: number): Reserve {
  return { cash, debts, reserve: cash - debts };
}

/* ──────────────────────────────────────────────────────── cíl měsíce ──── */

export interface MonthGoalInput {
  monthlyBudget: number;
  /** Monthly instalments across active debts. */
  debtInstalments: number;
  /** Actually credited this month. */
  received: number;
  /** Planned income for this month. */
  onTheWay: number;
}

export interface MonthGoal {
  /** rozpočet + splátky dluhů */
  needed: number;
  received: number;
  onTheWay: number;
  /** potřeba − přišlo − na cestě. Zero or less means covered. */
  missing: number;
  covered: boolean;
  /** How much lands above the goal once it is covered. */
  extra: number;
}

/**
 * cíl měsíce = rozpočet + splátky dluhů
 *
 * Instalments are added on top of the household budget deliberately: that is
 * what makes debts get paid out of what is earned rather than out of the
 * family's spending money.
 */
export function computeMonthGoal(input: MonthGoalInput): MonthGoal {
  const needed = input.monthlyBudget + input.debtInstalments;
  const missing = needed - input.received - input.onTheWay;
  return {
    needed,
    received: input.received,
    onTheWay: input.onTheWay,
    missing,
    covered: missing <= 0,
    extra: missing < 0 ? -missing : 0,
  };
}

/* ─────────────────────────────────────────────────────────── obálky ───── */

export type EnvelopeState = "v klidu" | "dochází" | "nad plánem";

export interface Envelope {
  spent: number;
  limit: number | null;
  /** limit − utraceno, when a limit is set. */
  remaining: number | null;
  state: EnvelopeState | null;
  /** How much of the bar is within the limit, 0–100. */
  fillPercent: number;
  /** How far past the limit, as a share of the limit. */
  overPercent: number;
}

/**
 * "dochází" fires under 20 % of the limit — early enough to change the week,
 * late enough not to cry wolf. State is always paired with a word in the UI,
 * never carried by colour alone.
 */
export function computeEnvelope(spent: number, limit: number | null): Envelope {
  if (limit === null || limit <= 0) {
    return { spent, limit: null, remaining: null, state: null, fillPercent: 0, overPercent: 0 };
  }

  const remaining = limit - spent;
  const state: EnvelopeState =
    remaining < 0 ? "nad plánem" : remaining < limit * 0.2 ? "dochází" : "v klidu";

  return {
    spent,
    limit,
    remaining,
    state,
    fillPercent: Math.min(100, (spent / limit) * 100),
    overPercent: remaining < 0 ? Math.min(100, (-remaining / limit) * 100) : 0,
  };
}

/* ──────────────────────────────────────────────────────────── dluhy ───── */

export interface CalcDebt {
  remainingAmount: number;
  installmentAmount: number;
  active: boolean;
}

export interface DebtPayoff {
  /** Instalments still to pay, or null when there is no instalment to divide by. */
  months: number | null;
  cleanBy: IsoMonth | null;
}

/** čistí = ceil(zbývá ÷ splátka) měsíců od `fromMonth` včetně */
export function estimatePayoff(debt: CalcDebt, fromMonth: IsoMonth): DebtPayoff {
  if (debt.installmentAmount <= 0) return { months: null, cleanBy: null };
  if (debt.remainingAmount <= 0) return { months: 0, cleanBy: null };

  const months = Math.ceil(debt.remainingAmount / debt.installmentAmount);
  // The first instalment lands in fromMonth, so the last is months−1 later.
  return { months, cleanBy: addMonths(fromMonth, months - 1) };
}

export interface DebtsSummary {
  totalOwed: number;
  monthlyInstalments: number;
  /** The month the longest-living debt clears — never an average. */
  cleanBy: IsoMonth | null;
}

export function summariseDebts(
  debts: readonly CalcDebt[],
  fromMonth: IsoMonth,
): DebtsSummary {
  const active = debts.filter((debt) => debt.active);

  return {
    totalOwed: active.reduce((sum, debt) => sum + debt.remainingAmount, 0),
    monthlyInstalments: active.reduce((sum, debt) => sum + debt.installmentAmount, 0),
    cleanBy: active.reduce<IsoMonth | null>((latest, debt) => {
      const { cleanBy } = estimatePayoff(debt, fromMonth);
      if (cleanBy === null) return latest;
      return latest === null || cleanBy > latest ? cleanBy : latest;
    }, null),
  };
}

/* ─────────────────────────────────────────────────────────── cashflow ─── */

export interface MonthResult {
  month: IsoMonth;
  income: number;
  expenses: number;
  /** příjmy − výdaje */
  result: number;
  kind: "actual" | "forecast";
}

/** výsledek měsíce = příjmy − výdaje */
export function monthResult(
  month: IsoMonth,
  income: number,
  expenses: number,
  kind: MonthResult["kind"],
): MonthResult {
  return { month, income, expenses, result: income - expenses, kind };
}

export interface CashPoint {
  month: IsoMonth;
  cash: number;
  kind: "actual" | "forecast";
  belowZero: boolean;
}

export interface CashOverTimeInput {
  /** Cash on the accounts today — the anchor the past is pinned to. */
  cashToday: number;
  currentMonth: IsoMonth;
  /** Months before the current one, oldest first, with their known balances. */
  past: readonly { month: IsoMonth; cash: number }[];
  /** Forecast months in order, each with its result and one-off outgoings. */
  future: readonly { month: IsoMonth; result: number; extraordinary: number }[];
}

/**
 * hotovost(m+1) = hotovost(m) + výsledek měsíce − mimořádné výdaje toho měsíce
 *
 * Extraordinary outgoings — a yearly insurance premium, winter tyres — are
 * subtracted separately from the monthly result because they are exactly what
 * a smooth average hides, and they are what actually pushes a month below zero.
 */
export function cashOverTime(input: CashOverTimeInput): CashPoint[] {
  const points: CashPoint[] = input.past.map((point) => ({
    month: point.month,
    cash: point.cash,
    kind: "actual" as const,
    belowZero: point.cash < 0,
  }));

  points.push({
    month: input.currentMonth,
    cash: input.cashToday,
    kind: "actual",
    belowZero: input.cashToday < 0,
  });

  let running = input.cashToday;
  for (const month of input.future) {
    running += month.result - month.extraordinary;
    points.push({
      month: month.month,
      cash: running,
      kind: "forecast",
      belowZero: running < 0,
    });
  }

  return points;
}

/* ───────────────────────────────────────────────────────── průměry ────── */

/**
 * Mean of the values present. Absent months are skipped, never counted as 0.
 *
 * The distinction matters more than it sounds: a household with one imported
 * month divided by six would read "+500 % proti průměru" on every category,
 * which says nothing except that five months are missing. `null` is how a
 * caller says "we have no statement for this month" — as opposed to `0`,
 * which says "we genuinely spent nothing".
 */
export function average(values: readonly (number | null)[]): number {
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  if (present.length === 0) return 0;
  return Math.round(present.reduce((sum, value) => sum + value, 0) / present.length);
}

/** "+7 %" against the six-month average, for the category trends. */
export function percentAgainstAverage(latest: number, mean: number): number {
  if (mean === 0) return 0;
  return Math.round(((latest - mean) / mean) * 100);
}
