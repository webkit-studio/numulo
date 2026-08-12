import { count } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { accounts, categories, users } from "@/db/schema";
import { LogoutButton } from "./logout-button";

// Reads D1 on every request — nothing here can be prerendered at build time.
export const dynamic = "force-dynamic";

type Health =
  | { ok: true; accounts: number; users: number; categories: number }
  | { ok: false; error: string };

async function readHealth(): Promise<Health> {
  try {
    const db = getDb();
    const [accountRows, userRows, categoryRows] = await Promise.all([
      db.select({ value: count() }).from(accounts),
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(categories),
    ]);
    return {
      ok: true,
      accounts: accountRows[0]?.value ?? 0,
      users: userRows[0]?.value ?? 0,
      categories: categoryRows[0]?.value ?? 0,
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export default async function OverviewPage() {
  const health = await readHealth();

  return (
    <main className="skeleton-screen">
      <header className="skeleton-header">
        <h1 className="login-wordmark">numo</h1>
        <LogoutButton />
      </header>

      <section className="skeleton-card">
        <h2>Kostra stojí</h2>
        <p>
          Přehled, Plán, Pravidelné, Vývoj, Dluhy, Transakce a Import se staví
          ve fázích 2–4. Tahle stránka zatím jen dokazuje, že aplikace běží,
          brána hesla drží a databáze odpovídá.
        </p>

        {health.ok ? (
          <dl className="skeleton-stats">
            <div>
              <dt>Účty</dt>
              <dd className="numo-numeric">{health.accounts}</dd>
            </div>
            <div>
              <dt>Uživatelé</dt>
              <dd className="numo-numeric">{health.users}</dd>
            </div>
            <div>
              <dt>Kategorie</dt>
              <dd className="numo-numeric">{health.categories}</dd>
            </div>
          </dl>
        ) : (
          <p role="alert" className="login-error">
            Databáze neodpovídá: {health.error}
          </p>
        )}
      </section>
    </main>
  );
}
