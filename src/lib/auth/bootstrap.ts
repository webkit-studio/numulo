import { count, isNotNull } from "drizzle-orm";
import type { Db } from "@/db/getDb";
import { users } from "@/db/schema";

/**
 * Is this installation still unclaimed?
 *
 * True only while no account anywhere has a password. That is the one moment
 * when accepting a bare `{email, password}` is defensible: there is nothing to
 * steal yet, and someone has to be able to get in the first time without an
 * e-mail service configured.
 *
 * Deliberately a property of the whole deployment, not of the individual
 * account. Per-account it reads as "this row has no password yet", which stays
 * true indefinitely for anyone who has not logged in — and since every query in
 * numo is scoped to one hard-coded account, claiming any such row is claiming
 * the household's entire financial history.
 */
export async function bootstrapOpen(db: Db): Promise<boolean> {
  const [row] = await db
    .select({ value: count() })
    .from(users)
    .where(isNotNull(users.passwordSetAt));

  return (row?.value ?? 0) === 0;
}
