import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { hashPassword, normalizeEmail, validatePassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";
import { turnstileConfigured, verifyTurnstile } from "@/lib/auth/turnstile";
import { withJsonErrors } from "@/lib/http";
import { users } from "@/db/schema";
import { eq, sql } from "drizzle-orm";

export const dynamic = "force-dynamic";

/**
 * Sign-up, behind a Turnstile check and an allowlist.
 *
 * ── Why this is not open registration ──────────────────────────────────────
 * Every query in numo is scoped by the hard-coded ACCOUNT_ID = 1 and nothing
 * consults account_members. So *any* valid session is full read/write access to
 * this household's bank history. An open sign-up form is therefore not a
 * sign-up form — it is a public download of the family's finances, one bot
 * check away.
 *
 * Until accounts are genuinely separated, a person may only claim an e-mail
 * that is already in `users` and has never had a password. That is the
 * behaviour migration 0001 documented from the start; the first implementation
 * of this route drifted from it.
 *
 * This route therefore never INSERTs a user. It only ever fills in the password
 * of a row that was seeded by a migration.
 */
export const POST = withJsonErrors(async (request: NextRequest) => {
  if (!turnstileConfigured()) {
    return NextResponse.json(
      { error: "Registrace je zavřená — chybí nastavení ochrany proti botům." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    name?: unknown;
    email?: unknown;
    password?: unknown;
    turnstileToken?: unknown;
  } | null;

  const check = await verifyTurnstile(
    typeof body?.turnstileToken === "string" ? body.turnstileToken : "",
    request.headers.get("cf-connecting-ip"),
  );
  if (!check.ok) {
    return NextResponse.json({ error: check.reason }, { status: 400 });
  }

  const email = normalizeEmail(String(body?.email ?? ""));
  const password = String(body?.password ?? "");
  const name = String(body?.name ?? "").trim();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "To nevypadá jako e-mail." }, { status: 400 });
  }

  const complaint = validatePassword(password);
  if (complaint) return NextResponse.json({ error: complaint }, { status: 400 });

  const db = getDb();
  const user = await findUserByEmail(db, email);

  // Deliberately the same answer for "not on the allowlist" and "already has a
  // password". Distinguishing them would turn this form into a directory of
  // who lives in this household and which of them has logged in yet.
  if (!user || user.passwordSetAt) {
    return NextResponse.json(
      {
        error:
          "Pro tenhle e-mail účet založit nejde. numo je rodinná appka — " +
          "přístup zakládá někdo, kdo už uvnitř je.",
      },
      { status: 403 },
    );
  }

  const { hash, salt } = await hashPassword(password);

  const [updated] = await db
    .update(users)
    .set({
      passwordHash: hash,
      passwordSalt: salt,
      passwordSetAt: new Date().toISOString(),
      sessionEpoch: sql`${users.sessionEpoch} + 1`,
      // The seeded name stands unless the person offered a better one.
      ...(name === "" ? {} : { name }),
    })
    .where(eq(users.id, user.id))
    .returning({
      id: users.id,
      name: users.name,
      sessionEpoch: users.sessionEpoch,
    });

  console.log(`[numo] heslo nastaveno registrací pro uživatele ${updated.id}`);

  const response = NextResponse.json({
    ok: true,
    user: { id: updated.id, name: updated.name },
  });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(updated.id, updated.sessionEpoch),
    sessionCookieOptions,
  );
  return response;
});
