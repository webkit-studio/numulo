import type { Metadata } from "next";
import { ExpenseForm } from "@/components/expense-form";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/data/household";
import { todayIso } from "@/lib/data/months";

export const metadata: Metadata = { title: "Numulo — zapsat výdaj" };
export const dynamic = "force-dynamic";

export default async function AddExpensePage() {
  const { household } = await getSession();
  if (!household) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, color")
    .eq("household_id", household.id)
    .order("sort");

  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">Zapsat výdaj</h1>
          <p className="page-sub">co ve výpisu nikdy nebude — hotovost</p>
        </div>
      </header>

      <section className="card card-narrow">
        <ExpenseForm
          householdId={household.id}
          categories={(data ?? []).map((row) => ({
            id: String(row.id),
            name: String(row.name),
            color: String(row.color),
          }))}
          today={todayIso()}
        />
      </section>
    </>
  );
}
