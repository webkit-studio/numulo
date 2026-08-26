import { createClient } from "@/lib/supabase/server";
import {
  average,
  monthResult,
  percentAgainstAverage,
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
  trends: CategoryTrend[];
  averages: { name: string; color: string; mean: number }[];
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
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("date, amount, category_id, is_business, is_transfer")
      .eq("household_id", household.id)
      .gte("date", from)
      .lte("date", to),
    supabase.from("categories").select("id, name, color, sort, parent_id").eq("household_id", household.id).order("sort"),
    supabase.from("subscriptions").select("amount, active").eq("household_id", household.id),
    supabase.from("recurring_monthly").select("amount, active").eq("household_id", household.id),
    supabase.from("recurring_yearly").select("name, amount, due_month, active").eq("household_id", household.id),
    supabase.from("planned_items").select("*").eq("household_id", household.id).eq("active", true),
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

  const monthlyTotal = (monthlyRows ?? [])
    .filter((row) => row.active)
    .reduce((sum, row) => sum + Number(row.amount), 0);

  /** Yearly premiums and one-off planned expenses — what a smooth month hides. */
  const extraordinaryFor = (month: IsoMonth) => {
    const monthNo = Number(month.slice(5, 7));
    const yearly = (yearlyRows ?? []).reduce(
      (sum, row) => (row.active && row.due_month === monthNo ? sum + Number(row.amount) : sum),
      0,
    );
    const planned = (plannedRows ?? []).reduce(
      (sum, row) =>
        row.direction === "expense" &&
        (row.interval === "monthly" || row.month === month)
          ? sum + Number(row.amount)
          : sum,
      0,
    );
    return yearly + planned;
  };

  const pastMonths = lastMonths(addMonths(currentMonth, -1), PAST).filter((month) =>
    monthsWithData.has(month),
  );
  const futureMonths = Array.from({ length: FORECAST }, (_, index) =>
    addMonths(currentMonth, index + 1),
  );

  const cashflow: MonthResult[] = [
    ...pastMonths.map((month) =>
      monthResult(month, income.get(month) ?? 0, expenses.get(month) ?? 0, "actual"),
    ),
  ];

  /*
   * Forecast income is NEVER the budget.
   *
   * An earlier version drew future months as "the budget arrives, the budget
   * minus savings leaves" — which for a household with irregular income
   * invents money out of thin air and paints every future month green. The
   * only income a forecast may claim is income somebody actually planned
   * (planned_items, direction income, that month). No planned income means
   * the line goes down, in red — that is the entire point of looking at it.
   *
   * Forecast expenses are what is actually known to be coming: subscriptions,
   * monthly recurring, yearly items due that month, planned expenses.
   */
  const knownOutgoings = (month: IsoMonth) =>
    subscriptionTotal + monthlyTotal + extraordinaryFor(month);

  const currentSpending = expenses.get(currentMonth) ?? 0;
  cashflow.push(
    monthResult(
      currentMonth,
      (income.get(currentMonth) ?? 0) + plannedFor(currentMonth, "income"),
      Math.max(currentSpending, knownOutgoings(currentMonth)),
      "forecast",
    ),
  );

  for (const month of futureMonths) {
    cashflow.push(
      monthResult(month, plannedFor(month, "income"), knownOutgoings(month), "forecast"),
    );
  }

  /* ── trendy a průměry ───────────────────────────────────────────────── */

  const known = history.filter((month) => monthsWithData.has(month));

  // Children roll into their parent: the trend of "Jídlo" is food including
  // fastfood, the same way the envelope measures it.
  const rows = categoryRows ?? [];
  const parentOf = new Map(rows.map((row) => [row.id as string, (row.parent_id as string) ?? null]));
  const rolled = new Map<string, Map<IsoMonth, number>>();
  for (const [categoryId, series] of byCategory) {
    const target = parentOf.get(categoryId) ?? categoryId;
    const bucket = rolled.get(target) ?? new Map<IsoMonth, number>();
    for (const [month, value] of series) bucket.set(month, (bucket.get(month) ?? 0) + value);
    rolled.set(target, bucket);
  }

  const categories = rows
    .filter((row) => !row.parent_id)
    .map((row) => {
      const spend = rolled.get(row.id as string);
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

  // Every category the household spends in — a trends screen that hand-picks
  // four rows answers its own question, not the reader's.
  const spendingCategories = categories
    .filter((category) => category.mean > 0)
    .sort((a, b) => b.mean - a.mean);

  return {
    months: known,
    cashflow,
    trends: known.length < 2 ? [] : spendingCategories,
    averages: spendingCategories.map(({ name, color, mean }) => ({ name, color, mean })),
  };
}

/** Kept for the debts page, which needs monthly instalments without the rest. */
export function instalmentTotal(rows: { installment_amount: unknown; active: unknown }[]): number {
  return rows.reduce(
    (sum, row) => (row.active ? sum + Number(row.installment_amount) : sum),
    0,
  );
}
