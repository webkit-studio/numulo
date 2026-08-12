import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { validatePassword } from "@/lib/auth/password";
import { consumeResetToken } from "@/lib/auth/reset-tokens";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { findUserByEmail, findUserById, setUserPassword } from "@/lib/auth/users";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let email = "";
  let password = "";
  let token = "";
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.email === "string") email = body.email;
    if (typeof body.password === "string") password = body.password;
    if (typeof body.token === "string") token = body.token;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const complaint = validatePassword(password);
  if (complaint) return NextResponse.json({ error: complaint }, { status: 400 });

  const db = getDb();
  let userId: number | null = null;

  if (token) {
    userId = await consumeResetToken(db, token);
    if (userId === null) {
      return NextResponse.json(
        { error: "Odkaz už neplatí. Nech si poslat nový." },
        { status: 400 },
      );
    }
  } else {
    // Bootstrap: allowed only while the account has never had a password.
    const user = await findUserByEmail(db, email);
    if (!user || user.passwordSetAt) {
      return NextResponse.json(
        { error: "Tenhle e-mail už heslo má — použij odkaz z mailu." },
        { status: 400 },
      );
    }
    userId = user.id;
  }

  await setUserPassword(db, userId, password);

  const user = await findUserById(db, userId);
  const response = NextResponse.json({
    ok: true,
    user: { id: userId, name: user?.name ?? null },
  });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(userId),
    sessionCookieOptions,
  );
  return response;
}
