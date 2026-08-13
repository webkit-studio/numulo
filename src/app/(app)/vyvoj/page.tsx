import type { Metadata } from "next";

export const metadata: Metadata = { title: "numo — Vývoj" };

export default function Page() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Vývoj</h1>
          <p className="page-sub">Cashflow, hotovost v čase, trendy kategorií a šestiměsíční průměry.</p>
        </div>
      </header>

      <section className="card">
        <p className="empty-note">
          Tahle stránka se staví jako další v pořadí. Sedm měsíců historie už v databázi je, takže grafy budou mít co kreslit hned.
        </p>
      </section>
    </>
  );
}
