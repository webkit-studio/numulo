import { and, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { transactions } from "@/db/schema";
import {
  actualMonth,
  averageVariableSpending,
  cashOverTime,
  forecastMonth,
  type CashPoint,
  type Forecast,
  type MonthResult,
} from "@/lib/calc/cashflow";
import { addMonths, lastMonths, monthRange, type IsoMonth } from "@/lib/date";
import { ACCOUNT_ID, getAccount } from "./queries";
import {
  getDebts,
  getPlannedItems,
  getRecurringMonthly,
  getRecurringYearly,
  getSubscriptions,
} from "./plan";

/**
 * Per-month totals, aggregated in SQL.
 *
 * The calc functions take transactions, but feeding them a year of rows just
 * to add them up is wasteful — one synthetic row per month gives the same
 * answer for anything that only sums.
 */
async function monthlyAggregates(): Promise<
  Map<IsoMonth, { income: number; expenses: number; net: number }>
> {
  const rows = await getDb()
    .select({
      month: sql<string>`substr(${transactions.date}, 1, 7)`,
      income: sql<number>`coalesce(sum(case when ${transactions.amount} > 0 and ${transactions.isTransfer} = 0 then ${transactions.amount} else 0 end), 0)`,
      expenses: sql<number>`coalesce(-sum(case when ${transactions.amount} < 0 and ${transactions.isTransfer} = 0 and ${transactions.isBusiness} = 0 then ${transactions.amount} else 0 end), 0)`,
      net: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(eq(transactions.accountId, ACCOUNT_ID))
    .groupBy(sql`substr(${transactions.date}, 1, 7)`);

  return new Map(
    rows.map((row) => [
      row.month,
      {
        income: Number(row.income),
        expenses: Number(row.expenses),
        net: Number(row.net),
      },
    ]),
  );
}

/**
 * Net movement per month counting only what lands after the opening-balance
 * date, so the cash line starts from the same position Rezerva does.
 *
 * The cut-off can fall mid-month, so it is applied per row in SQL — filtering
 * whole months would silently re-count everything before it.
 */
async function netByMonthAfter(
  cutoff: string | null,
): Promise<Map<IsoMonth, number>> {
  const rows = await getDb()
    .select({
      month: sql<string>`substr(${transactions.date}, 1, 7)`,
      net: sql<number>`coalesce(sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      cutoff === null
        ? eq(transactions.accountId, ACCOUNT_ID)
        : and(
            eq(transactions.accountId, ACCOUNT_ID),
            sql`${transactions.date} > ${cutoff}`,
          ),
    )
    .groupBy(sql`substr(${transactions.date}, 1, 7)`);

  return new Map(rows.map((row) => [row.month, Number(row.net)]));
}

/**
 * Household spending per month with recurring items taken out.
 *
 * Recurring items are forecast from their own tables, so leaving them in the
 * average would count them twice in every future month.
 */
async function variableByMonth(
  recurringNames: readonly string[],
): Promise<Map<IsoMonth, number>> {
  const rows = await getDb()
    .select({
      month: sql<string>`substr(${transactions.date}, 1, 7)`,
      merchant: sql<string>`lower(coalesce(nullif(${transactions.merchant}, ''), ${transactions.description}, ''))`,
      spent: sql<number>`coalesce(-sum(${transactions.amount}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.accountId, ACCOUNT_ID),
        eq(transactions.isTransfer, false),
        eq(transactions.isBusiness, false),
        sql`${transactions.amount} < 0`,
      ),
    )
    .groupBy(sql`substr(${transactions.date}, 1, 7)`, sql`lower(coalesce(nullif(${transactions.merchant}, ''), ${transactions.description}, ''))`);

  const names = recurringNames
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length >= 3);

  const byMonth = new Map<IsoMonth, number>();
  for (const row of rows) {
    if (names.some((name) => row.merchant.includes(name))) continue;
    byMonth.set(row.month, (byMonth.get(row.month) ?? 0) + Number(row.spent));
  }
  return byMonth;
}

export interface TrendsData {
  months: MonthResult[];
  forecasts: Forecast[];
  cash: CashPoint[];
  cashStartsAt: IsoMonth | null;
  variableAverage: number;
  /** Mean household spending across completed months. */
  averageExpenses: number;
  averageIncome: number;
  /** False while no recurring items are entered — then "variable" is simply all of it. */
  hasRecurring: boolean;
  currentMonth: IsoMonth;
}

/**
 * Everything the Vývoj page draws: past months as they happened, the next
 * `forecastMonths` as they are expected, and the cash line through both.
 */
export async function getTrends(
  currentMonth: IsoMonth,
  forecastMonths = 6,
): Promise<TrendsData> {
  const [account, aggregates, debts, recurring, subs, yearly, planned] =
    await Promise.all([
      getAccount(),
      monthlyAggregates(),
      getDebts(),
      getRecurringMonthly(),
      getSubscriptions(),
      getRecurringYearly(),
      getPlannedItems(),
    ]);

  const variable = await variableByMonth([
    ...recurring.map((item) => item.name),
    ...subs.map((item) => item.name),
  ]);

  const known = [...aggregates.keys()].sort();
  const firstMonth = known[0] ?? currentMonth;
  const lastActual = known[known.length - 1] ?? currentMonth;

  // Past runs to the last month with data; the forecast starts the month after,
  // so no month is ever drawn twice.
  const pastMonths = monthRange(firstMonth, lastActual);
  const futureMonths = monthRange(
    addMonths(lastActual, 1),
    addMonths(lastActual, forecastMonths),
  );

  const months: MonthResult[] = pastMonths.map((month) => {
    const totals = aggregates.get(month) ?? { income: 0, expenses: 0, net: 0 };
    return {
      month,
      income: totals.income,
      expenses: totals.expenses,
      result: totals.income - totals.expenses,
      kind: "actual",
    };
  });

  const variableAverage = averageVariableSpending(
    variable,
    addMonths(lastActual, 1),
    6,
  );

  const forecasts = futureMonths.map((month) =>
    forecastMonth({
      month,
      monthlyBudget: account.monthlyBudget,
      debts,
      recurringMonthly: recurring,
      subscriptions: subs.filter((item) => item.status === "confirmed"),
      recurringYearly: yearly,
      plannedItems: planned,
      variableAverage,
    }),
  );

  const forecastResultByMonth = new Map(
    forecasts.map((forecast) => [forecast.month, forecast.result]),
  );

  const netAfterCutoff = await netByMonthAfter(account.initialBalanceDate);

  // The cash line may only start where numo knows the balance. Everything
  // before the opening-balance date is history that was deliberately excluded
  // from Rezerva, so drawing it would assert a position nobody entered — a
  // flat line at the opening balance across months that actually moved.
  const cashFrom = account.initialBalanceDate
    ? account.initialBalanceDate.slice(0, 7)
    : firstMonth;

  const cashMonths = [...pastMonths, ...futureMonths].filter(
    (month) => month >= cashFrom,
  );

  const cash = cashOverTime({
    initialBalance: account.initialBalance,
    // The cut-off is already applied in the query above, so applying it again
    // here would drop the cut-off month twice.
    initialBalanceDate: null,
    // One synthetic row per month: cashOverTime only ever sums within a month.
    transactions: [...netAfterCutoff.entries()].map(([month, net]) => ({
      date: `${month}-15`,
      amount: net,
      isBusiness: false,
      isTransfer: false,
    })),
    months: cashMonths,
    currentMonth: addMonths(lastActual, 1),
    forecastResultByMonth,
  });

  // Same window as variableAverage, or the tiles contradict each other: a
  // subset of spending must never average higher than the whole.
  const windowMonths = new Set(lastMonths(lastActual, 6));
  const recent = months.filter((month) => windowMonths.has(month.month));

  const mean = (values: number[]) =>
    values.length === 0
      ? 0
      : Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);

  return {
    months,
    forecasts,
    cash,
    /** Set when the chart starts later than the data, so the page can say why. */
    cashStartsAt: cashFrom > firstMonth ? cashFrom : null,
    variableAverage,
    averageExpenses: mean(recent.map((month) => month.expenses)),
    averageIncome: mean(recent.map((month) => month.income)),
    hasRecurring: recurring.length + subs.length > 0,
    currentMonth: lastActual,
  };
}

export { actualMonth };
