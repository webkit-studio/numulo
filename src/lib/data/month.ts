import { createClient } from "@/lib/supabase/server";
import {
  computeDailyLimit,
  computeEnvelope,
  computeMonthGoal,
  computeObligations,
  computePlanned,
  computeRemaining,
  computeReserve,
  computeSavings,
  computeSpending,
  summariseDebts,
  type DailyLimit,
  type Envelope,
  type MonthGoal,
  type Reserve,
} from "@/lib/calc";
import { monthEnd, monthStart, type IsoMonth } from "@/lib/date";
import type { HouseholdRow } from "./household";

/**
 * One query pass, every number on the Přehled.
 *
 * Assembled in a single place because the spec's figures are interlocking —
 * spending feeds the remainder, the remainder feeds the daily limit, the
 * limit's projection needs the variable half of spending. Computing them in
 * separate components would mean each one re-deriving its inputs, and the
 * first divergence would be invisible.
 */

export interface CategorySpend {
  id: string;
  name: string;
  color: string;
  parentId: string | null;
  monthlyLimit: number | null;
  inEnvelopes: boolean;
  /** Own spend plus every child's — what the envelope measures. */
  spent: number;
  /** Spend booked directly on this category, without children. */
  ownSpent: number;
  /** Children with any spend this month, largest first. */
  children: { id: string; name: string; spent: number }[];
  envelope: Envelope;
}

export interface TransactionRow {
  id: string;
  date: string;
  amount: number;
  merchant: string | null;
  description: string | null;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  ownerId: string | null;
  isBusiness: boolean;
  isTransfer: boolean;
  status: "confirmed" | "review";
}

export interface MonthSnapshot {
  month: IsoMonth;
  /** Day of the month "today" falls on, clamped into the month being viewed. */
  today: number;
  isCurrentMonth: boolean;
  /** Income actually credited this month (transfers and business excluded). */
  income: number;
  spending: number;
  variableSpending: number;
  obligations: number;
  planned: number;
  savings: number;
  remaining: number;
  dailyLimit: DailyLimit;
  reserve: Reserve;
  goal: MonthGoal;
  categories: CategorySpend[];
  transactions: TransactionRow[];
  /** Spending per day of the month, for the heatmap. */
  daily: { day: number; spent: number }[];
  paidCount: number;
  dueCount: number;
  latestTransactionDate: string | null;
  /** True while the household has never recorded a transaction. */
  isEmpty: boolean;
}

export async function getMonthSnapshot(
  household: HouseholdRow,
  month: IsoMonth,
  todayIso: string,
): Promise<MonthSnapshot> {
  const supabase = await createClient();
  const from = monthStart(month);
  const to = monthEnd(month);

  const [
    { data: txRows },
    { data: categoryRows },
    { data: subscriptionRows },
    { data: monthlyRows },
    { data: yearlyRows },
    { data: paidRows },
    { data: plannedRows },
    { data: debtRows },
    { data: latestRow },
    { count: totalTransactions },
    { data: sinceRows },
  ] = await Promise.all([
    supabase
      .from("transactions")
      .select("*, categories(name, color)")
      .eq("household_id", household.id)
      .gte("date", from)
      .lte("date", to)
      .order("date", { ascending: false }),
    supabase.from("categories").select("*").eq("household_id", household.id).order("sort"),
    supabase.from("subscriptions").select("*").eq("household_id", household.id),
    supabase.from("recurring_monthly").select("*").eq("household_id", household.id),
    supabase.from("recurring_yearly").select("*").eq("household_id", household.id),
    supabase.from("recurring_payments").select("*").eq("household_id", household.id).eq("month", month),
    supabase.from("planned_items").select("*").eq("household_id", household.id).eq("active", true),
    supabase.from("debts").select("*").eq("household_id", household.id),
    supabase
      .from("transactions")
      .select("date")
      .eq("household_id", household.id)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("household_id", household.id),
    supabase
      .from("transactions")
      .select("amount")
      .eq("household_id", household.id)
      .gt("date", household.initial_balance_date ?? "0001-01-01"),
  ]);

  const transactions: TransactionRow[] = (txRows ?? []).map((row) => {
    const category = row.categories as unknown as { name: string; color: string } | null;
    return {
      id: row.id as string,
      date: row.date as string,
      amount: Number(row.amount),
      merchant: row.merchant as string | null,
      description: row.description as string | null,
      categoryId: row.category_id as string | null,
      categoryName: category?.name ?? null,
      categoryColor: category?.color ?? null,
      ownerId: row.owner_id as string | null,
      isBusiness: Boolean(row.is_business),
      isTransfer: Boolean(row.is_transfer),
      status: row.status as "confirmed" | "review",
    };
  });

  const subscriptions = (subscriptionRows ?? []).filter((row) => row.active);
  const monthlyItems = (monthlyRows ?? []).filter((row) => row.active);
  const yearlyItems = (yearlyRows ?? []).filter((row) => row.active);
  const debts = (debtRows ?? []).map((row) => ({
    remainingAmount: Number(row.remaining_amount),
    installmentAmount: Number(row.installment_amount),
    active: Boolean(row.active),
  }));

  const paid = new Set(
    (paidRows ?? []).map((row) => `${row.item_type}:${row.item_id}`),
  );

  const subscriptionTotal = subscriptions.reduce((sum, row) => sum + Number(row.amount), 0);

  /* ── výdaje ─────────────────────────────────────────────────────────── */

  // A subscription charged through the bank is already inside the transaction
  // sum; adding its list price again would count it twice. What still belongs
  // in spending is the subscription someone ticked off as paid whose charge
  // the statement does not show — paid from another account, statement not
  // imported yet.
  const merchantsThisMonth = transactions
    .filter((tx) => tx.amount < 0)
    .map((tx) => (tx.merchant ?? tx.description ?? "").toLowerCase());

  const paidSubsOffStatement = subscriptions.reduce((sum, row) => {
    if (!paid.has(`subscription:${row.id}`)) return sum;
    const name = String(row.name).trim().toLowerCase();
    const inStatement =
      name.length >= 3 && merchantsThisMonth.some((m) => m.includes(name));
    return inStatement ? sum : sum + Number(row.amount);
  }, 0);

  const spending = computeSpending({
    month,
    transactions: transactions.map((tx) => ({
      date: tx.date,
      amount: tx.amount,
      isBusiness: tx.isBusiness,
      isTransfer: tx.isTransfer,
    })),
    subscriptions: paidSubsOffStatement,
  });

  // The fixed half is what the recurring tables already account for; what is
  // left is what the daily pace is actually measuring.
  const recurringNames = [...subscriptions, ...monthlyItems].map((row) =>
    String(row.name).trim().toLowerCase(),
  );

  const variableSpending = transactions.reduce((sum, tx) => {
    if (tx.isBusiness || tx.isTransfer || tx.amount >= 0) return sum;
    const merchant = (tx.merchant ?? tx.description ?? "").toLowerCase();
    const isRecurring = recurringNames.some(
      (name) => name.length >= 3 && merchant.includes(name),
    );
    return isRecurring ? sum : sum - tx.amount;
  }, 0);

  /* ── povinnosti a plánované ─────────────────────────────────────────── */

  const monthNumber = Number(month.slice(5, 7));

  const unpaidMonthly = monthlyItems.reduce(
    (sum, row) => (paid.has(`monthly:${row.id}`) ? sum : sum + Number(row.amount)),
    0,
  );
  const unpaidSubscriptions = subscriptions.reduce(
    (sum, row) => (paid.has(`subscription:${row.id}`) ? sum : sum + Number(row.amount)),
    0,
  );
  const unpaidYearly = yearlyItems.reduce(
    (sum, row) =>
      row.due_month === monthNumber && !paid.has(`yearly:${row.id}`)
        ? sum + Number(row.amount)
        : sum,
    0,
  );

  const obligations = computeObligations({
    unpaidMonthly,
    unpaidSubscriptions,
    expected: unpaidYearly,
  });

  const appliesThisMonth = (row: { interval: string; month: string | null }) =>
    row.interval === "monthly" || row.month === month;

  const plannedExpenses = (plannedRows ?? []).reduce(
    (sum, row) =>
      row.direction === "expense" && appliesThisMonth(row) ? sum + Number(row.amount) : sum,
    0,
  );
  const plannedIncome = (plannedRows ?? []).reduce(
    (sum, row) =>
      row.direction === "income" && appliesThisMonth(row) ? sum + Number(row.amount) : sum,
    0,
  );

  const planned = computePlanned(obligations, plannedExpenses);

  /* ── zbývá, limit, rezerva, cíl ─────────────────────────────────────── */

  // Income is what actually arrived this month — never a configured number.
  // Business income and transfers stay out, the same as on the expense side.
  const received = transactions.reduce(
    (sum, tx) => (tx.amount > 0 && !tx.isTransfer && !tx.isBusiness ? sum + tx.amount : sum),
    0,
  );

  const savings = computeSavings(
    { mode: household.savings_mode, value: Number(household.savings_value) },
    received,
  );

  const remaining = computeRemaining({
    income: received,
    spending,
    planned,
    savings,
  });

  // Viewing a past month means the whole month is elapsed; viewing the current
  // one means today. Either way the limit answers "what is left from here".
  const isCurrentMonth = todayIso.startsWith(month);
  const today = isCurrentMonth
    ? Number(todayIso.slice(8, 10))
    : todayIso > month
      ? 31
      : 1;

  const dailyLimit = computeDailyLimit({
    month,
    today,
    remaining,
    savings,
    variableSpending,
  });

  const summary = summariseDebts(debts, month);

  // Cash is the opening balance plus everything that moved after its date.
  const movement = (sinceRows ?? []).reduce((sum, row) => sum + Number(row.amount), 0);
  const reserve = computeReserve(
    Number(household.initial_balance) + movement,
    summary.totalOwed,
  );

  const goal = computeMonthGoal({
    // What the month costs. Debt instalments are not added on top: when they
    // ride inside a recurring payment they are already in `planned`, and
    // demanding them twice was exactly the confusion being removed.
    monthCost: spending + planned + savings,
    received,
    onTheWay: plannedIncome,
  });

  /* ── obálky a heatmapa ──────────────────────────────────────────────── */

  const spentByCategory = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.isBusiness || tx.isTransfer || tx.amount >= 0 || !tx.categoryId) continue;
    spentByCategory.set(tx.categoryId, (spentByCategory.get(tx.categoryId) ?? 0) - tx.amount);
  }

  // Children roll up into their parent: the envelope and its limit live on
  // the parent, the children are the breakdown underneath it.
  const rows = categoryRows ?? [];
  const childrenOf = new Map<string, typeof rows>();
  for (const row of rows) {
    if (!row.parent_id) continue;
    const list = childrenOf.get(row.parent_id as string) ?? [];
    list.push(row);
    childrenOf.set(row.parent_id as string, list);
  }

  const categories: CategorySpend[] = rows
    .filter((row) => !row.parent_id)
    .map((row) => {
      const ownSpent = spentByCategory.get(row.id as string) ?? 0;
      const children = (childrenOf.get(row.id as string) ?? [])
        .map((child) => ({
          id: child.id as string,
          name: child.name as string,
          spent: spentByCategory.get(child.id as string) ?? 0,
        }))
        .sort((a, b) => b.spent - a.spent);

      const spent = ownSpent + children.reduce((sum, child) => sum + child.spent, 0);
      const limit = row.monthly_limit === null ? null : Number(row.monthly_limit);
      return {
        id: row.id as string,
        name: row.name as string,
        color: row.color as string,
        parentId: null,
        monthlyLimit: limit,
        inEnvelopes: Boolean(row.in_envelopes),
        spent,
        ownSpent,
        children,
        envelope: computeEnvelope(spent, limit),
      };
    });

  const dailyMap = new Map<number, number>();
  for (const tx of transactions) {
    if (tx.isBusiness || tx.isTransfer || tx.amount >= 0) continue;
    const day = Number(tx.date.slice(8, 10));
    dailyMap.set(day, (dailyMap.get(day) ?? 0) - tx.amount);
  }

  const daysTotal = Number(to.slice(8, 10));
  const daily = Array.from({ length: daysTotal }, (_, index) => ({
    day: index + 1,
    spent: dailyMap.get(index + 1) ?? 0,
  }));

  // "povinnosti 6/8" counts the monthly payments. Subscriptions are inside
  // the amount but not the count — nobody ticks Spotify off a list, and
  // mixing them in would make the ratio unrecognisable next month.
  const dueItems = monthlyItems.length;
  const paidCount = monthlyItems.filter((row) => paid.has(`monthly:${row.id}`)).length;

  return {
    month,
    today,
    isCurrentMonth,
    income: received,
    spending,
    variableSpending,
    obligations,
    planned,
    savings,
    remaining,
    dailyLimit,
    reserve,
    goal,
    categories,
    transactions,
    daily,
    paidCount,
    dueCount: dueItems,
    latestTransactionDate: (latestRow?.date as string) ?? null,
    isEmpty: (totalTransactions ?? 0) === 0,
  };
}
