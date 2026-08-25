import { createClient } from "@/lib/supabase/server";
import {
  average,
  cashOverTime,
  monthResult,
  percentAgainstAverage,
  type CashPoint,
  type MonthResult,
} from "@/lib/calc";
import { addMonths, lastMonths, monthEnd, monthStart, type IsoMonth } from "@/lib/date";
import type { HouseholdRow } from "./household";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Everything the Vývoj screen draws.
 *
 * One read of the last twelve months, aggregated in memory. Twelve months of a
 * household's payments is a few thousand rows — small enough that a round trip
 * per chart would cost more than the arithmetic does.
 *
 * The forecast deserves saying out loud: a future month's result is the
 * savings target, because that is what the plan *says* will be left over, and
 * we know nothing else about a month that has not happened. The one-off
 * outgoings we do know about — a yearly premium, a planned expense with a date
 * — are subtracted from cash separately, exactly as §4 has it. That is the
 * whole point of the cash curve: a smooth average never dips, and the dip is
 * the thing worth seeing.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export interface CategoryTrend {
  id: string;
  name: string;
  color: string;
  /** Six months, oldest first. */
  series: number[];
  latest: number;
  mean: number;
  percent: number;
}

export interface Trends {
  months: IsoMonth[];
  cashflow: MonthResult[];
  cash: CashPoint[];
  /** The month whose cash first goes negative, if any. */
  firstNegative: IsoMonth | null;
  trends: CategoryTrend[];
  averages: { name: string; color: string; mean: number }[];
  cashToday: number;
}

const PAST = 2;
const FORECAST = 3;
const HISTORY = 6;

export async function getTrends(
  household: HouseholdRow,
  currentMonth: IsoMonth,
): Promise<Trends> {
  const supabase = await createClient();

  const history = lastMonths(currentMonth, HISTORY);
  const from = monthStart(history[0]);
  const to = monthEnd(currentMonth);

  const [
    { data: txRows },
    { data: categoryRows },
    { data: subscriptionRows },
    { data: monthlyRows },
    { data: yearlyRows },
    { data: plannedRows },
    { data: sinceRows },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("date, amount, category_id, is_business, is_transfer")
      .eq("household_id", household.id)
      .gte("date", from)
      .lte("date", to),
    supabase.from("categories").select("id, name, color, sort").eq("household_id", household.id).order("sort"),
    supabase.from("subscriptions").select("amount, active").eq("household_id", household.id),
    supabase.from("recurring_monthly").select("amount, active").eq("household_id", household.id),
    supabase.from("recurring_yearly").select("name, amount, due_month, active").eq("household_id", household.id),
    supabase.from("planned_items").select("*").eq("household_id", household.id).eq("active", true),
    supabase
      .from("transactions")
      .select("amount")
      .eq("household_id", household.id)
      .gt("date", household.initial_balance_date ?? "0001-01-01"),
  ]);

  const budget = Number(household.monthly_budget);
  const savings =
    household.savings_mode === "percent"
      ? Math.round((budget * Number(household.savings_value)) / 100)
      : Number(household.savings_value);

  const subscriptionTotal = (subscriptionRows ?? [])
    .filter((row) => row.active)
    .reduce((sum, row) => sum + Number(row.amount), 0);

  /* ── měsíční příjmy a výdaje ze skutečnosti ─────────────────────────── */

  const income = new Map<IsoMonth, number>();
  const expenses = new Map<IsoMonth, number>();
  const byCategory = new Map<string, Map<IsoMonth, number>>();
  // A month with no statement is not a month where nothing was spent, and the
  // two must never be averaged together.
  const monthsWithData = new Set<IsoMonth>();

  for (const row of txRows ?? []) {
    const month = String(row.date).slice(0, 7);
    monthsWithData.add(month);
    if (row.is_transfer) continue;
    const amount = Number(row.amount);

    if (amount > 0) {
      income.set(month, (income.get(month) ?? 0) + amount);
      continue;
    }
    if (row.is_business) continue;

    expenses.set(month, (expenses.get(month) ?? 0) - amount);

    if (row.category_id) {
      const series = byCategory.get(row.category_id) ?? new Map<IsoMonth, number>();
      series.set(month, (series.get(month) ?? 0) - amount);
      byCategory.set(row.category_id, series);
    }
  }

  /* ── cashflow: minulost skutečná, teď podle §4, budoucnost podle plánu ─ */

  const plannedFor = (month: IsoMonth, direction: "expense" | "income") =>
    (plannedRows ?? []).reduce(
      (sum, row) =>
        row.direction === direction && (row.interval === "monthly" || row.month === month)
          ? sum + Number(row.amount)
          : sum,
      0,
    );

  /** Yearly premiums and one-off planned expenses — what a smooth month hides. */
  const extraordinaryFor = (month: IsoMonth) => {
    const monthNo = Number(month.slice(5, 7));
    const yearly = (yearlyRows ?? []).reduce(
      (sum, row) => (row.active && row.due_month === monthNo ? sum + Number(row.amount) : sum),
      0,
    );
    const oneOff = (plannedRows ?? []).reduce(
      (sum, row) =>
        row.direction === "expense" && row.interval === "once" && row.month === month
          ? sum + Number(row.amount)
          : sum,
      0,
    );
    return yearly + oneOff;
  };

  const pastMonths = lastMonths(addMonths(currentMonth, -1), PAST).filter((month) =>
    monthsWithData.has(month),
  );
  const futureMonths = Array.from({ length: FORECAST }, (_, index) =>
    addMonths(currentMonth, index + 1),
  );

  const cashflow: MonthResult[] = [
    ...pastMonths.map((month) =>
      monthResult(
        month,
        income.get(month) ?? 0,
        (expenses.get(month) ?? 0) + subscriptionTotal,
        "actual",
      ),
    ),
  ];

  // §4: říjnové výdaje = max(rozpočet − spoření, výdaje + plánované).
  // The budget is the floor because a month that has barely started has barely
  // spent anything, and drawing that as a windfall would be a lie.
  const currentSpending = (expenses.get(currentMonth) ?? 0) + subscriptionTotal;
  const currentPlanned = plannedFor(currentMonth, "expense");
  cashflow.push(
    monthResult(
      currentMonth,
      budget,
      Math.max(budget - savings, currentSpending + currentPlanned),
      "forecast",
    ),
  );

  for (const month of futureMonths) {
    // Nothing is known about a month that has not happened, so the plan is the
    // forecast: the budget comes in, the budget minus savings goes out, and
    // whatever is separately planned for that month moves it.
    cashflow.push(
      monthResult(
        month,
        budget + plannedFor(month, "income"),
        budget - savings + plannedFor(month, "expense"),
        "forecast",
      ),
    );
  }

  /* ── hotovost v čase ────────────────────────────────────────────────── */

  const movement = (sinceRows ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const cashToday = Number(household.initial_balance) + movement;

  // Past balances are pinned to today's figure and walked backwards through
  // each month's actual result — the same anchor the reserve tile uses.
  const pastCash: { month: IsoMonth; cash: number }[] = [];
  let running = cashToday;
  for (let index = cashflow.length - 1; index >= 0; index -= 1) {
    const point = cashflow[index];
    if (point.kind !== "actual") continue;
    pastCash.unshift({ month: point.month, cash: running - point.result });
    running -= point.result;
  }

  const cash = cashOverTime({
    cashToday,
    currentMonth,
    past: pastCash,
    future: futureMonths.map((month) => ({
      month,
      result: cashflow.find((point) => point.month === month)?.result ?? 0,
      extraordinary: extraordinaryFor(month),
    })),
  });

  /* ── trendy a průměry ───────────────────────────────────────────────── */

  const known = history.filter((month) => monthsWithData.has(month));

  const categories = (categoryRows ?? []).map((row) => {
    const spend = byCategory.get(row.id as string);
    const series = known.map((month) => spend?.get(month) ?? 0);
    const mean = average(series);
    const latest = series[series.length - 1] ?? 0;
    return {
      id: row.id as string,
      name: row.name as string,
      color: row.color as string,
      series,
      latest,
      mean,
      percent: percentAgainstAverage(latest, mean),
    };
  });

  const spendingCategories = categories.filter((category) => category.mean > 0);

  return {
    months: known,
    cashflow,
    cash,
    firstNegative: cash.find((point) => point.belowZero)?.month ?? null,
    // Four rows, the four the household actually spends in — and only once
    // there are two months to draw a line between.
    trends:
      known.length < 2
        ? []
        : [...spendingCategories].sort((a, b) => b.mean - a.mean).slice(0, 4),
    averages: [...spendingCategories]
      .sort((a, b) => b.mean - a.mean)
      .map(({ name, color, mean }) => ({ name, color, mean })),
    cashToday,
  };
}

/** Kept for the debts page, which needs monthly instalments without the rest. */
export function instalmentTotal(rows: { installment_amount: unknown; active: unknown }[]): number {
  return rows.reduce(
    (sum, row) => (row.active ? sum + Number(row.installment_amount) : sum),
    0,
  );
}
