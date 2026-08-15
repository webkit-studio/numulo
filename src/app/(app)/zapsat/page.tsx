import type { Metadata } from "next";
import { getCategories, getUsers } from "@/lib/data/queries";
import { ExpenseForm } from "./expense-form";

export const metadata: Metadata = { title: "numo — zapsat výdaj" };
export const dynamic = "force-dynamic";

export default async function RecordPage() {
  const [categories, users] = await Promise.all([getCategories(), getUsers()]);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Zapsat výdaj</h1>
          <p className="page-sub">
            Hotovost a všechno, co ve výpisu nebude
          </p>
        </div>
      </header>

      <section className="card">
        <ExpenseForm categories={categories} users={users} today={today} />
      </section>
    </>
  );
}
