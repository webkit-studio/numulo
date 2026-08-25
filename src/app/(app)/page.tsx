import Link from "next/link";
import type { Metadata } from "next";
import { Envelopes } from "@/components/envelopes";
import { Heatmap } from "@/components/heatmap";
import { Money } from "@/components/money";
import { MonthPicker } from "@/components/month-picker";
import { Info } from "@/components/tooltip";
import { TransactionList } from "@/components/transaction-list";
import { EmptyHousehold } from "@/components/empty-household";
import { getSession } from "@/lib/data/household";
import { getMonthSnapshot } from "@/lib/data/month";
import { getMonthsWithData, resolveMonth, todayIso } from "@/lib/data/months";
import { daysInMonth, shortDate } from "@/lib/date";
import { formatCzk } from "@/lib/money";

export const metadata: Metadata = { title: "Numulo — přehled" };
export const dynamic = "force-dynamic";

export default async function OverviewPage({
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
  const snapshot = await getMonthSnapshot(household, month, today);

  if (snapshot.isEmpty) {
    return <EmptyHousehold householdName={household.name} />;
  }

  const { dailyLimit: limit, reserve, goal } = snapshot;

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Přehled</h1>
          {snapshot.latestTransactionDate ? (
            <p className="page-sub">výpis k {shortDate(snapshot.latestTransactionDate)}</p>
          ) : null}
        </div>
        <MonthPicker
          months={months.all}
          current={month}
          dayNote={
            snapshot.isCurrentMonth
              ? `den ${snapshot.today} z ${daysInMonth(month)}`
              : undefined
          }
        />
      </header>

      {/* ── Bilance ─────────────────────────────────────────────────── */}
      <section className="card">
        <div className="card-head"><h2 className="card-title">Bilance</h2></div>

        <div className="balance">
          <div className="tile">
            <span className="tile-label">rozpočet</span>
            <p className="tile-value"><Money value={snapshot.monthlyBudget} tone="plain" /></p>
          </div>

          <div className="tile">
            <span className="tile-label">výdaje</span>
            <p className="tile-value"><Money value={snapshot.spending} tone="plain" /></p>
          </div>

          <div className="tile">
            <span className="tile-label">plánované</span>
            <p className="tile-value"><Money value={snapshot.planned} tone="plain" /></p>
            <p className="tile-note">nezaplacené + z Plánu</p>
          </div>

          <Link href="/plan" className="tile" style={{ textDecoration: "none" }}>
            <span className="tile-label">spoření</span>
            <p className="tile-value"><Money value={snapshot.savings} tone="plain" /></p>
          </Link>

          <div className="tile">
            <span className="tile-label">
              rezerva{" "}
              <Info>
                Hotovost {formatCzk(reserve.cash)} − dluhy {formatCzk(reserve.debts)} ={" "}
                {formatCzk(reserve.reserve)}.
              </Info>
            </span>
            <p className="tile-value"><Money value={reserve.reserve} /></p>
            <p className="tile-note">celková pozice</p>
          </div>

          <div className="tile-hero span-2">
            <span className="tile-label">zbývá na útratu</span>
            <p className="hero-value">
              <Money value={snapshot.remaining} tone={snapshot.remaining < 0 ? "auto" : "positive"} />
            </p>
          </div>
        </div>

        <Link href="/pravidelne" className="balance-foot">
          povinnosti <span className="num">{snapshot.paidCount}/{snapshot.dueCount}</span> · zbývá{" "}
          <Money value={snapshot.obligations} tone="plain" /> ›
        </Link>
      </section>

      {/* ── Denní limit ─────────────────────────────────────────────── */}
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">
            Denní limit{" "}
            <Info>
              Zbývá {formatCzk(snapshot.remaining + snapshot.savings)} − spoření{" "}
              {formatCzk(snapshot.savings)} = {formatCzk(snapshot.remaining)} na útratu.
              Děleno {limit.daysLeft} zbývajícími dny = {formatCzk(limit.perDay)} na den.
            </Info>
          </h2>
        </div>

        {limit.daysLeft === 0 ? (
          <p className="empty">
            Měsíc skončil. Průměrně jste utráceli <Money value={limit.pace} tone="plain" /> denně.
          </p>
        ) : (
          <>
            <p className="limit-value"><Money value={limit.perDay} tone="plain" /></p>
            <p className={`limit-projection ${limit.projection < 0 ? "warn" : "pos"}`}>
              tímhle tempem skončíš <Money value={limit.projection} tone="plain" />{" "}
              <Info>
                Zatím utrácíš průměrně {formatCzk(limit.pace)} denně (variabilní výdaje{" "}
                {formatCzk(snapshot.variableSpending)} ÷ {snapshot.today} dní). Stejným tempem
                utratíš do konce měsíce ještě asi {formatCzk(limit.willSpend)}.
              </Info>
            </p>
          </>
        )}
      </section>

      {/* ── Obálky ──────────────────────────────────────────────────── */}
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Obálky</h2>
          <Link href="/plan" className="card-link">spravovat rozpočty ›</Link>
        </div>
        <Envelopes categories={snapshot.categories} />
      </section>

      {/* ── Útraty podle dnů ────────────────────────────────────────── */}
      <section className="card">
        <div className="card-head"><h2 className="card-title">Útraty podle dnů</h2></div>
        <Heatmap
          days={snapshot.daily}
          month={month}
          today={snapshot.today}
          isCurrentMonth={snapshot.isCurrentMonth}
        />
      </section>

      {/* ── Poslední transakce ──────────────────────────────────────── */}
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Poslední transakce</h2>
          <Link href="/transakce" className="card-link">všechny ›</Link>
        </div>
        <TransactionList
          transactions={snapshot.transactions.slice(0, 5)}
          today={today}
          grouped={false}
        />
      </section>

      {/* Goal lives on Plán, but its shortfall is worth surfacing here. */}
      {!goal.covered && goal.missing > 0 ? (
        <Link href="/plan" className="card nudge">
          Do cíle měsíce schází <Money value={goal.missing} /> — podívej se do Plánu ›
        </Link>
      ) : null}
    </>
  );
}
