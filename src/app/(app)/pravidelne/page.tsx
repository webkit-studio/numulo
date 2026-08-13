import type { Metadata } from "next";

export const metadata: Metadata = { title: "numo — Pravidelné" };

export default function Page() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Pravidelné</h1>
          <p className="page-sub">Předplatná, měsíční a roční platby s checklistem zaplaceno.</p>
        </div>
      </header>

      <section className="card">
        <p className="empty-note">
          Tahle stránka se staví jako další v pořadí. Auto-detekce předplatných má v datech co najít — na účtu „Předplatná" jede Anthropic, Webflow, Notion a Relume v pravidelné kadenci.
        </p>
      </section>
    </>
  );
}
