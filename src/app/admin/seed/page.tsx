import type { Metadata } from "next";
import { SeedForm } from "./seed-form";

export const metadata: Metadata = { title: "numo — seed import historie" };
export const dynamic = "force-dynamic";

export default function SeedPage() {
  return (
    <main className="skeleton-screen">
      <h1 className="login-wordmark">Seed import historie</h1>
      <section className="skeleton-card">
        <p>
          Jednorázový import master CSV se sloučenou historií. Všechno v něm je
          historie — sytí průměry, trendy a Vývoj, ale <strong>Rezervu
          nemění</strong>. Datum posledního řádku se uloží jako hranice, za
          kterou teprve začínají reálné bankovní výpisy.
        </p>
        <p>
          Pustit se dá opakovaně: shodné řádky se podruhé nepřidají, takže
          druhý běh přidá nula řádků.
        </p>
        <SeedForm />
      </section>
    </main>
  );
}
