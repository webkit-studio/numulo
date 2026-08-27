import Link from "next/link";

/**
 * What a brand-new household sees instead of a wall of zeroes.
 *
 * Zeroes would not be neutral here — "příjmy 0 Kč · zbývá 0 Kč" reads as a
 * verdict on the family's finances rather than as "nothing has been entered
 * yet". So the dashboards are replaced outright until there is something real
 * to show. There is exactly one thing to do first, so it says exactly one.
 */
export function EmptyHousehold({ householdName }: { householdName: string }) {
  return (
    <>
      <header className="page-head">
        <div>
          <h1 className="page-title">{householdName}</h1>
          <p className="page-sub">zatím prázdno — pojďme to naplnit</p>
        </div>
      </header>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Začni tady</h2>
          <p className="card-sub">
            Jedna věc a Numulo začne počítat: dostaň dovnitř transakce. Příjmy
            i výdaje se čtou z nich — nikde se nic nenastavuje.
          </p>
        </div>

        <ol className="start-list">
          <li className="start-step">
            <span className="start-num num">1</span>
            <span className="start-body">
              <strong>Nahraj výpis z banky.</strong>
              <span>
                CSV nebo PDF, jakékoli banky — formát si Numulo přebere samo,
                duplicity pozná a napřed ukáže, co se stane.
              </span>
              <span className="start-actions">
                <Link href="/import" className="btn btn-primary">Nahrát výpis</Link>
                <Link href="/transakce" className="btn">Přidat záznam ručně</Link>
              </span>
            </span>
          </li>
        </ol>
      </section>

      <section className="card">
        <div className="card-head">
          <h2 className="card-title">Co se objeví, až budou data</h2>
        </div>
        <ul className="preview-list">
          <li><strong>Přehled</strong> — kolik dnes můžeš utratit a jak na tom stojíte</li>
          <li><strong>Plán</strong> — cíl měsíce, spoření a rozpočty kategorií</li>
          <li><strong>Pravidelné</strong> — co jede samo a jestli je to zaplacené</li>
          <li><strong>Vývoj</strong> — cashflow a trendy kategorií</li>
          <li><strong>Dluhy</strong> — kolik dlužíte a kdy budete čistí</li>
        </ul>
      </section>
    </>
  );
}
