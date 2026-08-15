import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { accountMembers, users } from "@/db/schema";
import { hashPassword, normalizeEmail } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";
import { turnstileConfigured, verifyTurnstile } from "@/lib/auth/turnstile";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

const MIN_PASSWORD = 10;

/**
 * Public sign-up, behind a Turnstile check.
 *
 * Registration is closed unless the bot check is configured. An open form with
 * a silently disabled check is worse than no form: it looks protected, and
 * nobody would find out otherwise until the table is full of junk accounts.
 */
export const POST = withJsonErrors(async (request: NextRequest) => {
  if (!turnstileConfigured()) {
    return NextResponse.json(
      {
        error:
          "Registrace je zavřená — chybí nastavení ochrany proti botům.",
      },
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

  const name = String(body?.name ?? "").trim();
  const email = normalizeEmail(String(body?.email ?? ""));
  const password = String(body?.password ?? "");

  if (name === "") {
    return NextResponse.json({ error: "Napiš, jak ti máme říkat." }, { status: 400 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "To nevypadá jako e-mail." }, { status: 400 });
  }
  if (password.length < MIN_PASSWORD) {
    return NextResponse.json(
      { error: `Heslo musí mít aspoň ${MIN_PASSWORD} znaků.` },
      { status: 400 },
    );
  }

  const db = getDb();

  if (await findUserByEmail(db, email)) {
    // Says plainly that the address is taken. Hiding it would only push the
    // person into "forgot password", which reveals the same thing anyway.
    return NextResponse.json(
      { error: "Na tenhle e-mail už účet je. Zkus se přihlásit." },
      { status: 409 },
    );
  }

  const { hash, salt } = await hashPassword(password);

  const [user] = await db
    .insert(users)
    .values({
      name,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      passwordSetAt: new Date().toISOString(),
    })
    .returning({ id: users.id, name: users.name });

  await db
    .insert(accountMembers)
    .values({ accountId: ACCOUNT_ID, userId: user.id, role: "member" })
    .onConflictDoNothing();

  const response = NextResponse.json({ ok: true, user });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(user.id),
    sessionCookieOptions,
  );
  return response;
});
