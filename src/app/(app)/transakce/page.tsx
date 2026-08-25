import type { Metadata } from "next";
import { MonthPicker } from "@/components/month-picker";
import { Money } from "@/components/money";
import { TransactionFilters } from "./filters";
import { EditableTransactions } from "./editable-transactions";
import { getMembers, getSession } from "@/lib/data/household";
import { getMonthSnapshot } from "@/lib/data/month";
import { getMonthsWithData, resolveMonth, todayIso } from "@/lib/data/months";

export const metadata: Metadata = { title: "Numulo — transakce" };
export const dynamic = "force-dynamic";

const one = (v: string | string[] | undefined) =>
  typeof v === "string" && v !== "" ? v : null;

export default async function TransactionsPage({
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
  const [snapshot, members] = await Promise.all([
    getMonthSnapshot(household, month, today),
    getMembers(household.id),
  ]);

  const search = one(params.hledat)?.toLowerCase() ?? null;
  const categoryId = one(params.kategorie);
  const ownerId = one(params.kdo);
  const showBusiness = one(params.podnikani) === "1";
  const showTransfers = one(params.prevody) === "1";

  const visible = snapshot.transactions.filter((tx) => {
    if (search) {
      const haystack = `${tx.merchant ?? ""} ${tx.description ?? ""}`.toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    if (categoryId && tx.categoryId !== categoryId) return false;
    if (ownerId && tx.ownerId !== ownerId) return false;
    // Business and transfers are out of every household total, so showing them
    // unasked would make this list disagree with every number on screen.
    if (!showBusiness && tx.isBusiness) return false;
    if (!showTransfers && tx.isTransfer) return false;
    return true;
  });

  const spent = visible.reduce(
    (sum, tx) => (tx.amount < 0 && !tx.isBusiness && !tx.isTransfer ? sum - tx.amount : sum),
    0,
  );

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Transakce</h1>
          <p className="page-sub">
            {visible.length} položek · utraceno <Money value={spent} tone="plain" />
          </p>
        </div>
        <MonthPicker months={months.all} current={month} />
      </header>

      <TransactionFilters
        categories={snapshot.categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
        members={members.map((m) => ({ id: m.userId, name: m.name }))}
        month={month}
        search={one(params.hledat)}
        categoryId={categoryId}
        ownerId={ownerId}
        showBusiness={showBusiness}
        showTransfers={showTransfers}
      />

      <section className="card">
        <EditableTransactions
          transactions={visible}
          categories={snapshot.categories.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
          members={members}
          today={today}
        />
      </section>
    </>
  );
}
