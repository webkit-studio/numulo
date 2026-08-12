import { eq } from "drizzle-orm";
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
    })
    .from(users)
    .where(eq(users.id, id));

  return user ?? null;
}

/** Sets a password and kills every outstanding reset link for that person. */
export async function setUserPassword(
  db: Db,
  userId: number,
  password: string,
  now = Date.now(),
): Promise<void> {
  const { hash, salt } = await hashPassword(password);

  await db
    .update(users)
    .set({
      passwordHash: hash,
      passwordSalt: salt,
      passwordSetAt: new Date(now).toISOString(),
    })
    .where(eq(users.id, userId));

  await invalidateTokensFor(db, userId, now);
}
