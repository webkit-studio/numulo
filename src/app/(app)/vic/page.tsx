import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "numo — víc" };

/** The mobile "Víc" tab: everything the four tabs don't reach. */
const SECTIONS = [
  { href: "/zapsat", text: "Zapsat výdaj", note: "hotovost a co ve výpisu nebude" },
  { href: "/transakce/roztridit", text: "Roztřídit", note: "útraty bez kategorie" },
  { href: "/pravidelne", text: "Pravidelné", note: "předplatná a platby" },
  { href: "/vyvoj", text: "Vývoj", note: "cashflow a trendy" },
  { href: "/dluhy", text: "Dluhy", note: "kolik dlužíme a dokdy" },
  { href: "/import", text: "Import", note: "nahrát výpis" },
  { href: "/nastaveni", text: "Nastavení", note: "rozpočet a počáteční stav" },
];

export default function MorePage() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Víc</h1>
        </div>
      </header>

      <section className="card">
        <ul className="more-list">
          {SECTIONS.map((section) => (
            <li key={section.href}>
              <Link href={section.href}>
                <span>{section.text}</span>
                <span className="more-note">{section.note}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
