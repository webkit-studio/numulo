import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * A hash to check against when the e-mail is unknown.
 *
 * Without it, an unknown address answers in a millisecond while a known one
 * takes the ~600,000 PBKDF2 iterations a real check costs. That gap is a clean
 * oracle for "does this person have an account here", measurable over the
 * network, and it defeats the point of the single shared error message below.
 *
 * Built once per isolate, lazily, so the cost lands on the first bad login
 * rather than on every cold start.
 */
let decoyPromise: Promise<{ hash: string; salt: string }> | null = null;

function decoy(): Promise<{ hash: string; salt: string }> {
  decoyPromise ??= hashPassword(crypto.randomUUID());
  return decoyPromise;
}

export const POST = withJsonErrors(async (request: NextRequest) => {
  let email = "";
  let password = "";
  try {
    const body = (await request.json()) as {
      email?: unknown;
      password?: unknown;
    };
    if (typeof body.email === "string") email = body.email;
    if (typeof body.password === "string") password = body.password;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const user = await findUserByEmail(getDb(), email);

  // One message for "no such e-mail" and "wrong password" alike, so the login
  // form cannot be used to find out who has an account here — and the same
  // work is done in both cases, so the clock cannot answer it either.
  const credentials = user?.passwordHash
    ? { hash: user.passwordHash, salt: user.passwordSalt }
    : await decoy();

  const matches = await verifyPassword(password, credentials);

  if (!user || !user.passwordHash || !matches) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name },
  });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(user.id, user.sessionEpoch),
    sessionCookieOptions,
  );
  return response;
});
