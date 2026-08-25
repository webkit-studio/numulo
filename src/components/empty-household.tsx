import Link from "next/link";

/**
 * What a brand-new household sees instead of a wall of zeroes.
 *
 * Zeroes would not be neutral here — "rozpočet 0 Kč · zbývá 0 Kč" reads as a
 * verdict on the family's finances rather than as "nothing has been entered
 * yet". So the dashboards are replaced outright until there is something real
 * to show, and the two things worth doing first are named in order.
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
            Dvě věci a Numulo začne počítat. Zbytek se doplní sám, jak budeš appku
            používat.
          </p>
        </div>

        <ol className="start-list">
          <li className="start-step">
            <span className="start-num num">1</span>
            <span className="start-body">
              <strong>Nastav měsíční rozpočet a kolik máte na účtech.</strong>
              <span>
                Bez rozpočtu nemá „zbývá na útratu“ z čeho počítat a bez počátečního
                stavu neví Rezerva, odkud začít.
              </span>
              <Link href="/nastaveni" className="btn">Otevřít nastavení</Link>
            </span>
          </li>

          <li className="start-step">
            <span className="start-num num">2</span>
            <span className="start-body">
              <strong>Nahraj výpis z banky.</strong>
              <span>
                Stačí CSV, jakékoli banky — formát si Numulo přečte samo a napřed ti
                ukáže, co se stane. Nebo si první výdaj zapiš ručně.
              </span>
              <span className="start-actions">
                <Link href="/import" className="btn btn-primary">Nahrát výpis</Link>
                <Link href="/zapsat" className="btn">Zapsat výdaj</Link>
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
          <li><strong>Vývoj</strong> — cashflow, hotovost v čase a trendy</li>
          <li><strong>Dluhy</strong> — kolik dlužíte a kdy budete čistí</li>
        </ul>
      </section>
    </>
  );
}
