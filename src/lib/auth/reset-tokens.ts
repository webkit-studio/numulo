import { and, eq, isNull } from "drizzle-orm";
import type { Db } from "@/db/getDb";
import { passwordResetTokens } from "@/db/schema";
import { sha256Hex } from "@/lib/import/fingerprint";

/** An hour is long enough to find the mail, short enough to limit exposure. */
const TTL_MS = 60 * 60 * 1000;

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Issues a reset token. Returns the plaintext — the only time it exists — for
 * the e-mail link; the database only ever sees its hash.
 */
export async function issueResetToken(
  db: Db,
  userId: number,
  now = Date.now(),
): Promise<string> {
  const token = randomToken();

  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: await sha256Hex(token),
    expiresAt: new Date(now + TTL_MS).toISOString(),
  });

  return token;
}

/**
 * Spends a token: valid, unused and unexpired ones are marked used and return
 * their user. Marking happens in the same step so a link cannot be replayed.
 */
export async function consumeResetToken(
  db: Db,
  token: string,
  now = Date.now(),
): Promise<number | null> {
  const tokenHash = await sha256Hex(token);

  const [row] = await db
    .select({
      id: passwordResetTokens.id,
      userId: passwordResetTokens.userId,
      expiresAt: passwordResetTokens.expiresAt,
    })
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
      ),
    );

  if (!row) return null;
  if (Date.parse(row.expiresAt) <= now) return null;

  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date(now).toISOString() })
    .where(eq(passwordResetTokens.id, row.id));

  return row.userId;
}

/** Called after a successful change so older links stop working. */
export async function invalidateTokensFor(
  db: Db,
  userId: number,
  now = Date.now(),
): Promise<void> {
  await db
    .update(passwordResetTokens)
    .set({ usedAt: new Date(now).toISOString() })
    .where(
      and(
        eq(passwordResetTokens.userId, userId),
        isNull(passwordResetTokens.usedAt),
      ),
    );
}
