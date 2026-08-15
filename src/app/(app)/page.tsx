import Link from "next/link";
import type { Metadata } from "next";
import { Envelopes } from "@/components/envelopes";
import { Heatmap } from "@/components/heatmap";
import { MonthLabel, Money, formatDayMonth } from "@/components/money";
import { MonthPicker } from "@/components/month-picker";
import { TransactionList } from "@/components/transaction-list";
import { computeDailyLimit } from "@/lib/calc/daily-limit";
import {
  getAccount,
  getCategories,
  getDailySpending,
  getDefaultMonth,
  getEnvelopes,
  getLatestTransactionDate,
  getMonthBalance,
  getMonthsWithData,
  getReserve,
  getTransactions,
  getUncategorisedCount,
} from "@/lib/data/queries";
import { formatCzk } from "@/lib/money";

export const metadata: Metadata = { title: "numo — přehled" };
export const dynamic = "force-dynamic";

export default async function OverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

  const months = await getMonthsWithData();
  const requested = typeof params.mesic === "string" ? params.mesic : null;
  const month =
    requested && months.includes(requested)
      ? requested
      : await getDefaultMonth(today);

  const [account, balance, reserve, envelopes, days, recent, latest, uncategorised, categories] =
    await Promise.all([
      getAccount(),
      getMonthBalance(month),
      getReserve(),
      getEnvelopes(month),
      getDailySpending(month),
      getTransactions({ month, limit: 8 }),
      getLatestTransactionDate(),
      getUncategorisedCount(month),
      getCategories(),
    ]);

  // Rezerva only means something once the opening cash position is entered.
  const reserveReady =
    account.initialBalance !== 0 || reserve.cash !== 0 || reserve.debts !== 0;

  const daily = computeDailyLimit({
    month,
    budget: balance.budget,
    spent: balance.spent,
    today,
  });

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Přehled</h1>
          {latest ? (
            <p className="page-sub">
              výpis k {formatDayMonth(latest)}
              {uncategorised > 0 ? (
                <>
                  {" · "}
                  {/* With most of the month unsorted the envelopes are empty and
                      every category number is wrong — so this is a link, not a
                      statistic. */}
                  <Link href="/transakce/roztridit">
                    {uncategorised} útrat bez kategorie — roztřídit ›
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
        </div>
        <MonthPicker months={months} current={month} basePath="/" />
      </header>

      <section className="tiles">
        <article className="tile">
          <h2>Rozpočet</h2>
          <p className="tile-value">
            <Money value={balance.budget} />
          </p>
          <p className="tile-note">
            strop útrat domácnosti, ne příjem
          </p>
        </article>

        <article className="tile">
          <h2>Utraceno</h2>
          <p className="tile-value">
            <Money value={balance.spent} />
          </p>
          <p className="tile-note">
            <MonthLabel month={month} />
          </p>
        </article>

        <article className={`tile${balance.remaining < 0 ? " is-alert" : ""}`}>
          <h2>Zbývá na útratu</h2>
          <p className="tile-value">
            <Money value={balance.remaining} />
          </p>
          <p className="tile-note">
            {balance.remaining < 0
              ? "rozpočet je překročený"
              : `z ${formatCzk(balance.budget)}`}
          </p>
        </article>

        <article
          className={`tile${!reserveReady ? "" : reserve.reserve < 0 ? " is-alert" : ""}`}
        >
          <h2>Rezerva</h2>
          {reserveReady ? (
            <>
              <p className="tile-value">
                <Money value={reserve.reserve} />
              </p>
              <p className="tile-note">
                hotovost {formatCzk(reserve.cash)} − dluhy{" "}
                {formatCzk(reserve.debts)}
              </p>
            </>
          ) : (
            <>
              {/* Zero here would be a claim, not a fact — nothing has been
                  entered yet, so say that instead of showing a number. */}
              <p className="tile-value tile-unset">—</p>
              <p className="tile-note">
                <Link href="/nastaveni">zadat počáteční stav ›</Link>
              </p>
            </>
          )}
        </article>
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Denní limit</h2>
          <span className="card-flag">podle §4 ještě neověřeno</span>
        </header>

        {daily.perDay === null ? (
          <p className="empty-note">
            Tenhle měsíc už skončil. Průměrně jste utráceli{" "}
            <strong>{formatCzk(daily.averageSoFar ?? 0)}</strong> denně.
          </p>
        ) : (
          <>
            <p className="hero-value">
              <Money value={daily.perDay} />
              <span className="hero-unit">/ den</span>
            </p>
            <p className="tile-note">
              {formatCzk(daily.remaining)} ÷ {daily.daysLeft}{" "}
              {daily.daysLeft === 1 ? "zbývající den" : "zbývajících dní"}
              {daily.averageSoFar !== null
                ? ` · zatím utrácíte ${formatCzk(daily.averageSoFar)} denně`
                : null}
            </p>
          </>
        )}
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Obálky</h2>
        </header>
        <Envelopes envelopes={envelopes} />
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Útraty po dnech</h2>
        </header>
        <Heatmap days={days} month={month} />
      </section>

      <section className="card">
        <header className="card-head">
          <h2>Poslední transakce</h2>
          <Link href={`/transakce?mesic=${month}`} className="card-action">
            všechny ›
          </Link>
        </header>
        <TransactionList
          transactions={recent}
          categories={categories}
          emptyNote="V tomhle měsíci nejsou žádné transakce."
        />
      </section>
    </>
  );
}
