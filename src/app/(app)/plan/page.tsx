import type { Metadata } from "next";

export const metadata: Metadata = { title: "numo — Plán" };

export default function Page() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Plán</h1>
          <p className="page-sub">Cíl měsíce, spoření, plánované položky a správa limitů kategorií.</p>
        </div>
      </header>

      <section className="card">
        <p className="empty-note">
          Tahle stránka se staví jako další v pořadí. Rozpočty kategorií potřebuju hlavně proto, aby obálky na Přehledu ukazovaly „zbývá" místo jen „utraceno".
        </p>
      </section>
    </>
  );
}
