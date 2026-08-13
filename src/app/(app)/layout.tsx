import Link from "next/link";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LogoutButton } from "../logout-button";
import { NavLink } from "./nav-link";

/**
 * Desktop sidebar in four groups, mobile tab bar in four tabs — the IA from
 * the brief. The groups answer numo's three questions in order: can I spend
 * today, are we handling this month, are we getting out of this.
 */
const GROUPS = [
  { label: "Dnes", items: [{ href: "/", text: "Přehled" }] },
  {
    label: "Měsíc",
    items: [
      { href: "/plan", text: "Plán" },
      { href: "/pravidelne", text: "Pravidelné" },
    ],
  },
  {
    label: "Dlouhodobě",
    items: [
      { href: "/vyvoj", text: "Vývoj" },
      { href: "/dluhy", text: "Dluhy" },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/transakce", text: "Transakce" },
      { href: "/import", text: "Import" },
      { href: "/nastaveni", text: "Nastavení" },
    ],
  },
];

const TABS = [
  { href: "/", text: "Domů" },
  { href: "/transakce", text: "Transakce" },
  { href: "/plan", text: "Plán" },
  { href: "/vic", text: "Víc" },
];

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <Link href="/" className="app-wordmark">
          numo
        </Link>

        <nav className="app-nav" aria-label="Hlavní navigace">
          {GROUPS.map((group) => (
            <div key={group.label} className="app-nav-group">
              <span className="app-nav-label">{group.label}</span>
              {group.items.map((item) => (
                <NavLink key={item.href} href={item.href}>
                  {item.text}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className="app-sidebar-foot">
          {user ? <span>{user.name}</span> : null}
          <LogoutButton />
        </div>
      </aside>

      <main className="app-main">{children}</main>

      <nav className="app-tabbar" aria-label="Hlavní navigace">
        {TABS.map((tab) => (
          <NavLink key={tab.href} href={tab.href} className="app-tab">
            {tab.text}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
