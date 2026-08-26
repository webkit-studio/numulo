"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Spec §5: four groups, each answering one of the app's questions. */
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
    ],
  },
];

const TABS = [
  { href: "/", text: "Přehled" },
  { href: "/transakce", text: "Transakce" },
  { href: "/plan", text: "Plán" },
  { href: "/vic", text: "Víc" },
];

function isActive(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export function AppNav({ variant = "sidebar" }: { variant?: "sidebar" | "tabs" }) {
  const pathname = usePathname();

  if (variant === "tabs") {
    return (
      <nav className="tabbar" aria-label="Hlavní navigace">
        {TABS.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            className={`tab${isActive(pathname, tab.href) ? " is-active" : ""}`}
            aria-current={isActive(pathname, tab.href) ? "page" : undefined}
          >
            {tab.text}
          </Link>
        ))}
      </nav>
    );
  }

  return (
    <nav className="nav" aria-label="Hlavní navigace">
      {GROUPS.map((group) => (
        <div key={group.label} className="nav-group">
          <span className="nav-label">{group.label}</span>
          {group.items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`nav-link${isActive(pathname, item.href) ? " is-active" : ""}`}
              aria-current={isActive(pathname, item.href) ? "page" : undefined}
            >
              {item.text}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
