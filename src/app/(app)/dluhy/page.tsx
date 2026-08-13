import type { Metadata } from "next";

export const metadata: Metadata = { title: "numo — Dluhy" };

export default function Page() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Dluhy</h1>
          <p className="page-sub">Kdo, kolik, splátka, odhad „čistý ~měsíc" a záznam mimořádné splátky.</p>
        </div>
      </header>

      <section className="card">
        <p className="empty-note">
          Tahle stránka se staví jako další v pořadí. V datech jsou vidět „SPLÁTKA DLUHU 05/2026" i mimořádná splátka 25 000 Kč, takže je z čeho vyjít.
        </p>
      </section>
    </>
  );
}
