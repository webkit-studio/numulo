import Link from "next/link";
import type { Metadata } from "next";
import { Money } from "@/components/money";
import { MonthPicker } from "@/components/month-picker";
import { Detected } from "./detected";
import { PaidList, type PayableRow } from "./paid-list";
import { Subscriptions, type SubscriptionRow } from "./subscriptions";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/data/household";
import { getListRows } from "@/lib/data/lists";
import { getMonthsWithData, resolveMonth, todayIso } from "@/lib/data/months";
import { detectSubscriptions } from "@/lib/recurring/detect";
import { estimatePayoff } from "@/lib/calc";
import { lastMonths, monthStart, monthNameOnly } from "@/lib/date";
import { formatCzk } from "@/lib/money";

export const metadata: Metadata = { title: "Numulo — pravidelné" };
export const dynamic = "force-dynamic";

export default async function RecurringPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const { household } = await getSession();
  if (!household) return null;

  const today = todayIso();
  const months = await getMonthsWithData(household.id, today);
  const month = resolveMonth(params.mesic, months, today);

  const supabase = await createClient();
  const [subscriptionRows, monthlyRows, yearlyRows, debtRows] = await Promise.all([
    getListRows(household.id, "subscriptions"),
    getListRows(household.id, "monthly"),
    getListRows(household.id, "yearly"),
    getListRows(household.id, "debts"),
  ]);

  const [{ data: paidRows }, { data: detectionRows }, { data: ignoreRows }] = await Promise.all([
    supabase
      .from("recurring_payments")
      .select("item_type, item_id")
      .eq("household_id", household.id)
      .eq("month", month),
    supabase
      .from("transactions")
      .select("date, amount, merchant")
      .eq("household_id", household.id)
      .lt("amount", 0)
      .eq("is_business", false)
      .eq("is_transfer", false)
      .gte("date", monthStart(lastMonths(month, 6)[0])),
    supabase
      .from("rules")
      .select("pattern")
      .eq("household_id", household.id)
      .eq("kind", "merchant->not_subscription"),
  ]);

  const paid = new Set((paidRows ?? []).map((row) => `${row.item_type}:${row.item_id}`));

  /* ── souhrny ────────────────────────────────────────────────────────── */

  const activeSubs = subscriptionRows.filter((row) => row.active);
  const activeMonthly = monthlyRows.filter((row) => row.active);
  const monthNo = Number(month.slice(5, 7));
  const dueYearly = yearlyRows.filter((row) => row.active && row.due_month === monthNo);

  const subscriptionTotal = activeSubs.reduce((sum, row) => sum + Number(row.amount), 0);
  const monthlyTotal = activeMonthly.reduce((sum, row) => sum + Number(row.amount), 0);

  // §3.4: the ratio is over the monthly payments. Subscriptions still count
  // towards the money outstanding, just not towards the tick-list.
  const dueCount = activeMonthly.length;
  const paidCount = activeMonthly.filter((row) => paid.has(`monthly:${row.id}`)).length;

  const outstanding =
    activeSubs.reduce(
      (sum, row) => (paid.has(`subscription:${row.id}`) ? sum : sum + Number(row.amount)),
      0,
    ) +
    activeMonthly.reduce(
      (sum, row) => (paid.has(`monthly:${row.id}`) ? sum : sum + Number(row.amount)),
      0,
    ) +
    dueYearly.reduce((sum, row) => (paid.has(`yearly:${row.id}`) ? sum : sum + Number(row.amount)), 0);

  /* ── auto-detekce ───────────────────────────────────────────────────── */

  const known = new Set([
    ...activeSubs.map((row) => String(row.name).trim().toLowerCase()),
    ...activeMonthly.map((row) => String(row.name).trim().toLowerCase()),
    ...(ignoreRows ?? []).map((row) => String(row.pattern)),
  ]);

  const candidates = detectSubscriptions(
    (detectionRows ?? [])
      .filter((row) => row.merchant)
      .map((row) => ({
        merchant: String(row.merchant),
        amount: -Number(row.amount),
        month: String(row.date).slice(0, 7),
        day: Number(String(row.date).slice(8, 10)),
      })),
    { latestMonth: month },
  )
    .filter((candidate) => candidate.stillRunning)
    .filter((candidate) => !known.has(candidate.name.trim().toLowerCase()))
    .slice(0, 3);

  /* ── řádky ──────────────────────────────────────────────────────────── */

  const subscriptions: SubscriptionRow[] = subscriptionRows.map((row) => ({
    id: row.id,
    name: String(row.name),
    amount: Number(row.amount),
    day: row.day === null ? null : Number(row.day),
    simulated: Boolean(row.simulated_cancel),
    values: row,
  }));

  const monthly: PayableRow[] = monthlyRows.map((row) => ({
    id: row.id,
    name: String(row.name),
    amount: Number(row.amount),
    day: row.day === null ? null : Number(row.day),
    dueMonth: null,
    paid: paid.has(`monthly:${row.id}`),
    values: row,
  }));

  const yearly: PayableRow[] = yearlyRows.map((row) => ({
    id: row.id,
    name: String(row.name),
    amount: Number(row.amount),
    day: null,
    dueMonth: Number(row.due_month),
    paid: paid.has(`yearly:${row.id}`),
    // A tick on a premium that is not due for five months would be a lie
    // waiting to happen; the badge already says when it lands.
    tickable: Number(row.due_month) === monthNo,
    values: row,
  }));

  const debts = debtRows.filter((row) => row.active && Number(row.installment_amount) > 0);

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Pravidelné</h1>
          <p className="page-sub">
            předplatná <Money value={subscriptionTotal} tone="plain" />/měs · měsíční platby{" "}
            <Money value={monthlyTotal} tone="plain" /> · zaplaceno{" "}
            <span className="num">{paidCount}/{dueCount}</span> · zbývá zaplatit{" "}
            <Money value={outstanding} tone="plain" />
          </p>
        </div>
        <MonthPicker months={months.all} current={month} />
      </header>

      <Detected householdId={household.id} candidates={candidates} />

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Předplatná</h2>
          <span className="card-sub">
            <Money value={subscriptionTotal} tone="plain" />/měs
          </span>
        </div>
        <Subscriptions householdId={household.id} rows={subscriptions} />
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Měsíční platby</h2>
          <span className="card-sub">
            zaplaceno <span className="num">{paidCount}/{dueCount}</span>
          </span>
        </div>

        <PaidList
          householdId={household.id}
          listKey="monthly"
          kind="monthly"
          month={month}
          rows={monthly}
          empty="Zatím žádné měsíční platby."
        />

        {debts.length > 0 ? (
          <div className="debt-note">
            <ul className="crud crud-quiet">
              {debts.map((row) => {
                const payoff = estimatePayoff(
                  {
                    remainingAmount: Number(row.remaining_amount),
                    installmentAmount: Number(row.installment_amount),
                    active: true,
                  },
                  month,
                );
                return (
                  <li key={row.id} className="crud-row">
                    <div className="crud-view">
                      <span className="crud-name">
                        {String(row.creditor)}
                        <Link href="/dluhy" className="badge badge-link">dluh</Link>
                        {row.installment_day ? (
                          <span className="crud-day">{Number(row.installment_day)}.</span>
                        ) : null}
                      </span>
                      <span className="crud-amount">
                        <Money value={Number(row.installment_amount)} tone="plain" />
                        {payoff.cleanBy ? (
                          <span className="crud-hint">čistý ~{monthNameOnly(payoff.cleanBy)}</span>
                        ) : null}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <p className="quiet-note">
              Splátky dluhů jsou uvnitř plateb výš — do součtů se nepřičítají znovu.
            </p>
          </div>
        ) : null}
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Roční platby</h2>
          {dueYearly.length > 0 ? (
            <span className="card-sub">
              tento měsíc {formatCzk(dueYearly.reduce((s, r) => s + Number(r.amount), 0))}
            </span>
          ) : null}
        </div>
        <PaidList
          householdId={household.id}
          listKey="yearly"
          kind="yearly"
          month={month}
          rows={yearly}
          empty="Zatím žádné roční platby — pojištění, známka, daně."
        />
      </section>
    </>
  );
}
