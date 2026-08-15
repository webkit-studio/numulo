import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db/getDb";
import { users } from "@/db/schema";
import { hashPassword, normalizeEmail } from "./password";
import { invalidateTokensFor } from "./reset-tokens";

export interface AuthUser {
  id: number;
  name: string;
  email: string | null;
  passwordHash: string | null;
  passwordSalt: string | null;
  passwordSetAt: string | null;
  sessionEpoch: number;
}

export async function findUserByEmail(
  db: Db,
  email: string,
): Promise<AuthUser | null> {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      passwordSalt: users.passwordSalt,
      passwordSetAt: users.passwordSetAt,
      sessionEpoch: users.sessionEpoch,
    })
    .from(users)
    .where(eq(users.email, normalizeEmail(email)));

  return user ?? null;
}

export async function findUserById(
  db: Db,
  id: number,
): Promise<AuthUser | null> {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      passwordHash: users.passwordHash,
      passwordSalt: users.passwordSalt,
      passwordSetAt: users.passwordSetAt,
      sessionEpoch: users.sessionEpoch,
    })
    .from(users)
    .where(eq(users.id, id));

  return user ?? null;
}

/**
 * Sets a password, kills every outstanding reset link, and ends every session
 * that was open under the old password.
 *
 * The epoch bump is the part that matters: without it a password change leaves
 * every previously issued cookie working for the rest of its 30 days, so the
 * one action taken *because* a password may be compromised would not lock the
 * other party out at all.
 *
 * Returns the new epoch, so the caller can mint a replacement cookie for the
 * person who just changed it — otherwise they log themselves out.
 */
export async function setUserPassword(
  db: Db,
  userId: number,
  password: string,
  now = Date.now(),
): Promise<number> {
  const { hash, salt } = await hashPassword(password);

  const [row] = await db
    .update(users)
    .set({
      passwordHash: hash,
      passwordSalt: salt,
      passwordSetAt: new Date(now).toISOString(),
      sessionEpoch: sql`${users.sessionEpoch} + 1`,
    })
    .where(eq(users.id, userId))
    .returning({ sessionEpoch: users.sessionEpoch });

  await invalidateTokensFor(db, userId, now);
  return row?.sessionEpoch ?? 1;
}
