import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validatePassword, verifyPassword } from "@/lib/auth/password";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { setUserPassword } from "@/lib/auth/users";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Changing your own password from inside the app.
 *
 * Its absence is what made a missing RESEND_API_KEY terminal rather than
 * annoying: with no way to change a password while signed in, the reset e-mail
 * was not the preferred channel, it was the only one that would ever exist.
 *
 * The current password is required even though the session already proves who
 * you are — a borrowed unlocked phone should not be enough to lock the owner
 * out of their own finances.
 */
export const POST = withJsonErrors(async (request: NextRequest) => {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nejsi přihlášený." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    current?: unknown;
    next?: unknown;
  } | null;

  const current = String(body?.current ?? "");
  const next = String(body?.next ?? "");

  const complaint = validatePassword(next);
  if (complaint) return NextResponse.json({ error: complaint }, { status: 400 });

  const matches = await verifyPassword(current, {
    hash: user.passwordHash,
    salt: user.passwordSalt,
  });
  if (!matches) {
    return NextResponse.json(
      { error: "Současné heslo nesedí." },
      { status: 403 },
    );
  }

  // Bumps the session epoch, so every other device is signed out. The cookie
  // below re-admits only the browser that did this.
  const epoch = await setUserPassword(getDb(), user.id, next);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(user.id, epoch),
    sessionCookieOptions,
  );
  return response;
});
