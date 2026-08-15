import type { Metadata } from "next";
import { hasAiKey } from "@/lib/env";
import { listProfiles } from "@/lib/import/profiles";
import { getImportHistory } from "@/lib/data/imports";
import { formatDayMonth } from "@/components/money";
import { ImportWizard } from "./import-wizard";
import { ProfileList } from "./profile-list";
import { SeedForm } from "./seed-form";

export const metadata: Metadata = { title: "numo — import" };
export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const [profiles, history] = await Promise.all([
    listProfiles(),
    getImportHistory(),
  ]);

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Import</h1>
          <p className="page-sub">
            Načti výpis, podívej se co se stane, teprve pak potvrď
          </p>
        </div>
      </header>

      <section className="card">
        <header className="card-head">
          <h2>Bankovní výpis</h2>
          <p className="card-sub">
            Formát se pozná sám — oddělovač, kódování i hlavička. Když si numo
            není jisté, zeptá se místo aby hádalo.
          </p>
        </header>
        <ImportWizard aiAvailable={hasAiKey()} />
      </section>

      {profiles.length > 0 ? (
        <section className="card">
          <header className="card-head">
            <h2>Zapamatované formáty</h2>
            <p className="card-sub">
              Výpis se stejnou hlavičkou se příště načte bez ptaní.
            </p>
          </header>
          <ProfileList
            profiles={profiles.map((profile) => ({
              id: profile.id,
              name: profile.name,
              detail: `${profile.encoding} · oddělovač „${profile.delimiter}"${
                profile.skipRows > 0 ? ` · ${profile.skipRows} řádků nad hlavičkou` : ""
              }`,
            }))}
          />
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="card">
          <header className="card-head">
            <h2>Historie importů</h2>
            <p className="card-sub">
              Originální soubory zůstávají v archivu — každé číslo v numo se z
              nich dá znovu spočítat.
            </p>
          </header>
          <ul className="crud-list">
            {history.map((batch) => (
              <li key={batch.id} className="crud-row">
                <span className="crud-main">
                  <span className="crud-title">{batch.filename}</span>
                  <span className="crud-meta">
                    {formatDayMonth(batch.importedAt.slice(0, 10))} ·{" "}
                    {batch.rowCount} transakcí
                    {batch.storageKey ? " · v archivu" : " · bez archivu"}
                    {batch.instructionsText ? ` · „${batch.instructionsText}"` : ""}
                  </span>
                </span>
                <span className="crud-actions crud-actions-empty" />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
