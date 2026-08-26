import { redirect } from "next/navigation";
import { getCategoryChips, getSession } from "@/lib/data/household";
import { todayIso } from "@/lib/data/months";
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
  const categoryRows = await getCategoryChips(household.id);

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
          categories={categoryRows}
          today={todayIso()}
        />
        <AppNav variant="tabs" />
      </div>
    </ToastProvider>
  );
}
