import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Víc" };

/**
 * The phone's fourth tab: everything the sidebar holds on a desktop.
 *
 * Import is here but says why it is not worth doing on a phone rather than
 * being silently missing — a screen that hides a feature teaches people it
 * does not exist.
 */
const SECTIONS = [
  {
    label: "Měsíc",
    items: [
      { href: "/pravidelne", title: "Pravidelné", note: "co jede samo a je to zaplacené" },
    ],
  },
  {
    label: "Dlouhodobě",
    items: [
      { href: "/vyvoj", title: "Vývoj", note: "cashflow, hotovost, trendy, průměry" },
      { href: "/dluhy", title: "Dluhy", note: "co dlužíme a kdy budeme čistí" },
    ],
  },
  {
    label: "Data",
    items: [
      { href: "/import", title: "Import", note: "výpis dovnitř — pohodlnější na počítači" },
      { href: "/transakce", title: "Přidat záznam", note: "výdaj nebo příjem ručně — tlačítko + v Transakcích" },
    ],
  },
  {
    label: "Účet",
    items: [{ href: "/nastaveni", title: "Nastavení účtu", note: "rozpočet, sdílení, kód domácnosti" }],
  },
];

export default function MorePage() {
  return (
    <>
      <header className="page-head">
        <div><h1 className="page-title">Víc</h1></div>
      </header>

      {SECTIONS.map((section) => (
        <section key={section.label} className="card">
          <div className="card-head"><h2 className="card-title">{section.label}</h2></div>
          <ul className="more">
            {section.items.map((item) => (
              <li key={item.href}>
                <Link href={item.href} className="more-link">
                  <span className="more-title">{item.title}</span>
                  <span className="more-note">{item.note}</span>
                  <span className="more-chevron" aria-hidden="true">›</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}
