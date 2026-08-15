import type { Metadata } from "next";
import { MonthPicker } from "@/components/month-picker";
import { TransactionList } from "@/components/transaction-list";
import { TransactionFilters } from "./filters";
import {
  getCategories,
  getDefaultMonth,
  getMonthsWithData,
  getTransactions,
  getUsers,
} from "@/lib/data/queries";

export const metadata: Metadata = { title: "numo — transakce" };
export const dynamic = "force-dynamic";

const one = (value: string | string[] | undefined): string | null =>
  typeof value === "string" && value !== "" ? value : null;

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const today = new Date().toISOString().slice(0, 10);

  const months = await getMonthsWithData();
  const requested = one(params.mesic);
  const month =
    requested && months.includes(requested)
      ? requested
      : await getDefaultMonth(today);

  const search = one(params.hledat);
  const ownerId = one(params.kdo);
  const categoryId = one(params.kategorie);
  const business = one(params.podnikani) === "1";
  const transfer = one(params.prevody) === "1";

  const [transactions, categories, users] = await Promise.all([
    getTransactions({
      month,
      search: search ?? undefined,
      ownerId: ownerId ? Number(ownerId) : undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      business,
      transfer,
      limit: 500,
    }),
    getCategories(),
    getUsers(),
  ]);

  const spent = transactions.reduce(
    (total, row) => (row.amount < 0 ? total - row.amount : total),
    0,
  );

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Transakce</h1>
          <p className="page-sub">
            {transactions.length} položek · utraceno{" "}
            <span className="numo-numeric">
              {new Intl.NumberFormat("cs-CZ", {
                maximumFractionDigits: 0,
              }).format(spent / 100)}{" "}
              Kč
            </span>
          </p>
        </div>
        <MonthPicker months={months} current={month} basePath="/transakce" />
      </header>

      <TransactionFilters
        categories={categories}
        users={users}
        month={month}
        search={search}
        ownerId={ownerId}
        categoryId={categoryId}
        business={business}
        transfer={transfer}
      />

      <section className="card">
        <TransactionList
          transactions={transactions}
          categories={categories}
          emptyNote="Nic neodpovídá filtrům."
        />
      </section>
    </>
  );
}
