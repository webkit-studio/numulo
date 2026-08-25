import { redirect } from "next/navigation";
import { getSession } from "@/lib/data/household";
import { todayIso } from "@/lib/data/months";
import { createClient } from "@/lib/supabase/server";
import { AppNav } from "@/components/app-nav";
import { AccountCard } from "@/components/account-card";
import { QuickAdd } from "@/components/quick-add";
import { ToastProvider } from "@/components/toast";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { viewer, household } = await getSession();

  if (!viewer) redirect("/prihlaseni");
  // Signed in but in no household yet — onboarding, not an empty dashboard.
  if (!household) redirect("/zalozit");

  // Fetched here so the quick-add sheet opens with chips already in it,
  // rather than showing an empty row while a request goes out.
  const supabase = await createClient();
  const { data: categoryRows } = await supabase
    .from("categories")
    .select("id, name, color")
    .eq("household_id", household.id)
    .order("sort");

  return (
    <ToastProvider>
      <div className="shell">
        <aside className="sidebar">
          <span className="wordmark">numulo</span>
          <AppNav />
          <AccountCard
            name={household.name}
            kind={household.kind}
            viewerName={viewer.displayName}
          />
        </aside>

        <main className="main">{children}</main>

        <QuickAdd
          householdId={household.id}
          categories={(categoryRows ?? []).map((row) => ({
            id: String(row.id),
            name: String(row.name),
            color: String(row.color),
          }))}
          today={todayIso()}
        />
        <AppNav variant="tabs" />
      </div>
    </ToastProvider>
  );
}
