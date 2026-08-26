import Link from "next/link";
import type { Metadata } from "next";
import { Cashflow } from "@/components/charts/cashflow";
import { Sparkline } from "@/components/charts/sparkline";
import { Money } from "@/components/money";
import { getSession } from "@/lib/data/household";
import { resolveMonth, todayIso } from "@/lib/data/months";
import { getTrends } from "@/lib/data/trends";

export const metadata: Metadata = { title: "Vývoj" };
export const dynamic = "force-dynamic";

export default async function TrendsPage() {
  const { household } = await getSession();
  if (!household) return null;

  const today = todayIso();
  const month = resolveMonth(undefined, today);
  const trends = await getTrends(household, month);

  // Nothing to plot is not the same as a month that came out at zero. Drawing
  // two flat lines through 0 · 0 · 0 · 0 under a note saying there is no data
  // is worse than drawing nothing: it looks like an answer.
  const nothingYet = trends.months.length === 0;

  if (nothingYet) {
    return (
      <>
        <header className="page-head">
          <div>
            <h1 className="page-title">Vývoj</h1>
            <p className="page-sub">jak se to vyvíjí a kam to směřuje</p>
          </div>
        </header>

        <section className="card">
          <div className="empty-block">
            <p className="empty-title">Zatím není co srovnávat</p>
            <p className="empty-body">
              Vývoj potřebuje aspoň dva měsíce historie — pak se tu objeví
              cashflow, křivka hotovosti a trendy kategorií. Naimportuj výpisy
              a graf se nakreslí sám.
            </p>
            <Link href="/import" className="btn btn-primary">Nahrát výpis</Link>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Vývoj</h1>
          <p className="page-sub">skutečnost zeleně · předpověď okrově</p>
        </div>
      </header>

      {/* ── Cashflow ────────────────────────────────────────────────── */}
      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Cashflow</h2>
          <span className="card-sub">kolik měsíc vydělal — příjmy minus výdaje</span>
        </div>
        <Cashflow points={trends.cashflow} />
      </section>

      {/* ── Trendy kategorií ────────────────────────────────────────── */}
      {trends.trends.length > 0 ? (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Trendy kategorií</h2>
            <span className="card-sub">posledních šest měsíců</span>
          </div>

          <ul className="trends">
            {trends.trends.map((trend) => (
              <li key={trend.id} className="trend">
                <span className="trend-name">
                  <span className="dot" style={{ background: trend.color }} aria-hidden="true" />
                  {trend.name}
                </span>
                <Sparkline series={trend.series} color={trend.color} />
                <span className="trend-figures">
                  <span className="trend-latest"><Money value={trend.latest} tone="plain" /></span>
                  <span className={`trend-delta ${trend.percent > 0 ? "up" : "down"}`}>
                    {trend.percent > 0 ? "+" : trend.percent < 0 ? "−" : ""}
                    {Math.abs(trend.percent)} % proti průměru
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {/* ── Průměry ─────────────────────────────────────────────────── */}
      {trends.averages.length > 0 ? (
        <section className="card">
          <div className="card-head">
            <h2 className="card-title">Průměry</h2>
            <span className="card-sub">Kč/měs za posledních šest měsíců</span>
          </div>

          <ul className="averages">
            {trends.averages.map((item) => (
              <li key={item.name}>
                <span className="average-name">
                  <span className="dot" style={{ background: item.color }} aria-hidden="true" />
                  {item.name}
                </span>
                <span className="average-value"><Money value={item.mean} tone="plain" /></span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </>
  );
}
