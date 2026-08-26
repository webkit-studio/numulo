import type { Metadata } from "next";
import { Money } from "@/components/money";
import { DebtList, type DebtRow } from "./debt-list";
import { getSession } from "@/lib/data/household";
import { getListRows } from "@/lib/data/lists";
import { todayIso } from "@/lib/data/months";
import { estimatePayoff, summariseDebts } from "@/lib/calc";
import { monthLabel, monthOf } from "@/lib/date";

export const metadata: Metadata = { title: "Dluhy" };
export const dynamic = "force-dynamic";

export default async function DebtsPage() {
  const { household } = await getSession();
  if (!household) return null;

  const today = todayIso();
  const month = monthOf(today);
  const debtRows = await getListRows(household.id, "debts");

  const summary = summariseDebts(
    debtRows.map((row) => ({
      remainingAmount: Number(row.remaining_amount),
      installmentAmount: Number(row.installment_amount),
      active: Boolean(row.active),
    })),
    month,
  );

  const rows: DebtRow[] = debtRows.map((row) => ({
    id: row.id,
    creditor: String(row.creditor),
    total: Number(row.total_amount),
    remaining: Number(row.remaining_amount),
    installment: Number(row.installment_amount),
    day: row.installment_day === null ? null : Number(row.installment_day),
    account: (row.target_account as string) ?? null,
    vs: (row.vs as string) ?? null,
    cleanBy:
      estimatePayoff(
        {
          remainingAmount: Number(row.remaining_amount),
          installmentAmount: Number(row.installment_amount),
          active: Boolean(row.active),
        },
        month,
      ).cleanBy ?? null,
    values: row,
  }));

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Dluhy</h1>
          <p className="page-sub">co dlužíme a kdy budeme čistí</p>
        </div>
      </header>

      <section className="card">
        <div className="balance balance-debts">
          <div className="tile">
            <span className="tile-label">celkem dlužíme</span>
            <p className="tile-value"><Money value={-summary.totalOwed} /></p>
          </div>
          <div className="tile">
            <span className="tile-label">splácíme</span>
            <p className="tile-value"><Money value={summary.monthlyInstalments} tone="plain" /></p>
            <p className="tile-note">každý měsíc</p>
          </div>
          <div className="tile-hero">
            <span className="tile-label">čistí</span>
            <p className="hero-value hero-text">
              {summary.cleanBy ? `~${monthLabel(summary.cleanBy)}` : "–"}
            </p>
            <p className="tile-note">podle nejdelšího dluhu</p>
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-head"><h2 className="card-title">Seznam dluhů</h2></div>
        <DebtList householdId={household.id} rows={rows} today={today} />
      </section>
    </>
  );
}
