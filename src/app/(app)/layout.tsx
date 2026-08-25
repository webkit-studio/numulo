import { redirect } from "next/navigation";
import { getSession } from "@/lib/data/household";
import { AppNav } from "@/components/app-nav";
import { AccountCard } from "@/components/account-card";
import { ToastProvider } from "@/components/toast";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { viewer, household } = await getSession();

  if (!viewer) redirect("/prihlaseni");
  // Signed in but in no household yet — onboarding, not an empty dashboard.
  if (!household) redirect("/zalozit");

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

        <AppNav variant="tabs" />
      </div>
    </ToastProvider>
  );
}
