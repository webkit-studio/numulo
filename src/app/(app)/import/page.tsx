import type { Metadata } from "next";
import { SeedForm } from "./seed-form";

export const metadata: Metadata = { title: "numo — import" };
export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Import</h1>
          <p className="page-sub">
            Bankovní výpisy z Air Bank a Revolutu se sem doplní, až budu mít
            reálné vzorky obou formátů.
          </p>
        </div>
      </header>

      <section className="card">
        <header className="card-head">
          <h2>Seed import historie</h2>
        </header>
        <p className="card-lede">
          Jednorázový import master CSV se sloučenou historií. Všechno v něm je
          historie — sytí průměry, trendy a Vývoj, ale <strong>Rezervu
          nemění</strong>. Datum posledního řádku se uloží jako hranice, za
          kterou teprve začínají reálné bankovní výpisy. Pustit se dá
          opakovaně: shodné řádky se podruhé nepřidají.
        </p>
        <SeedForm />
      </section>
    </>
  );
}
