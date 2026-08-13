"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function NavLink({
  href,
  children,
  className = "app-nav-item",
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  const pathname = usePathname();
  // "/" would otherwise prefix-match every route and light up permanently.
  const active = href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={className}
      aria-current={active ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
