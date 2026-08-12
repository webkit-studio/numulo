import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { findUserByEmail } from "@/lib/auth/users";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

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
  // form cannot be used to find out who has an account here.
  const matches =
    user !== null &&
    (await verifyPassword(password, {
      hash: user.passwordHash,
      salt: user.passwordSalt,
    }));

  if (!user || !matches) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const response = NextResponse.json({
    ok: true,
    user: { id: user.id, name: user.name },
  });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(user.id),
    sessionCookieOptions,
  );
  return response;
});
