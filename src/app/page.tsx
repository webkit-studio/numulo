import Link from "next/link";
import { count } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { accounts, categories, transactions, users } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth/current-user";
import { LogoutButton } from "./logout-button";

// Reads D1 on every request — nothing here can be prerendered at build time.
export const dynamic = "force-dynamic";

type Health =
  | {
      ok: true;
      accounts: number;
      users: number;
      categories: number;
      transactions: number;
    }
  | { ok: false; error: string };

async function readHealth(): Promise<Health> {
  try {
    const db = getDb();
    const [accountRows, userRows, categoryRows, transactionRows] =
      await Promise.all([
        db.select({ value: count() }).from(accounts),
        db.select({ value: count() }).from(users),
        db.select({ value: count() }).from(categories),
        db.select({ value: count() }).from(transactions),
      ]);
    return {
      ok: true,
      accounts: accountRows[0]?.value ?? 0,
      users: userRows[0]?.value ?? 0,
      categories: categoryRows[0]?.value ?? 0,
      transactions: transactionRows[0]?.value ?? 0,
    };
  } catch (error) {
    return { ok: false, error: (error as Error).message };
  }
}

export default async function OverviewPage() {
  const [health, user] = await Promise.all([readHealth(), getCurrentUser()]);

  return (
    <main className="skeleton-screen">
      <header className="skeleton-header">
        <h1 className="login-wordmark">numo</h1>
        <span className="skeleton-who">
          {user ? `Přihlášen jako ${user.name}` : null} <LogoutButton />
        </span>
      </header>

      <section className="skeleton-card">
        <h2>Kostra stojí</h2>
        <p>
          Přehled, Plán, Pravidelné, Vývoj, Dluhy, Transakce a Import se staví
          ve fázích 2–4. Tahle stránka zatím jen dokazuje, že aplikace běží,
          přihlášení drží a databáze odpovídá.
        </p>

        {health.ok ? (
          <>
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
              <div>
                <dt>Transakce</dt>
                <dd className="numo-numeric">{health.transactions}</dd>
              </div>
            </dl>

            {health.transactions === 0 ? (
              <p className="skeleton-next">
                Historie zatím není nahraná.{" "}
                <Link href="/admin/seed">Naimportovat master CSV ›</Link>
              </p>
            ) : (
              <p className="skeleton-next">
                <Link href="/admin/seed">Seed import historie ›</Link>
              </p>
            )}
          </>
        ) : (
          <p role="alert" className="login-error">
            Databáze neodpovídá: {health.error}
          </p>
        )}
      </section>
    </main>
  );
}
