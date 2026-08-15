import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { getCurrentUser } from "@/lib/auth/current-user";
import { issueResetToken } from "@/lib/auth/reset-tokens";
import { findUserById } from "@/lib/auth/users";
import { BASE_PATH } from "@/lib/base-path";
import { emailConfigured, passwordResetEmail, sendEmail } from "@/lib/email/send";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Issues a set-password link for another member of the household.
 *
 * This is the answer to "the e-mail service is down and someone is locked out".
 * The link is *shown on screen* to the signed-in person, who can read it aloud
 * or hand over the phone — the household is two people in one flat, and making
 * that wait on a third-party mail provider is what turned a missing API key
 * into a locked door.
 *
 * The authority here is an active session, not a claimed e-mail address. That
 * is the whole difference from the bootstrap path this replaces.
 */
export const POST = withJsonErrors(async (request: NextRequest) => {
  const actor = await getCurrentUser();
  if (!actor) {
    return NextResponse.json({ error: "Nejsi přihlášený." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as {
    userId?: unknown;
    alsoEmail?: unknown;
  } | null;

  const userId = Number(body?.userId);
  if (!Number.isInteger(userId)) {
    return NextResponse.json({ error: "Chybí uživatel." }, { status: 400 });
  }

  const db = getDb();
  const target = await findUserById(db, userId);
  if (!target) {
    return NextResponse.json({ error: "Uživatel nenalezen." }, { status: 404 });
  }

  const token = await issueResetToken(db, target.id);
  const origin = new URL(request.url).origin;
  const link = `${origin}${BASE_PATH}/heslo?token=${token}`;

  // Who issued it for whom, never the token itself — the log is readable in
  // the Cloudflare dashboard and a token there would be a live credential.
  console.log(
    `[numo] ${actor.name} (${actor.id}) vydal odkaz na heslo pro ${target.name} (${target.id})`,
  );

  let emailed = false;
  let emailError: string | null = null;

  if (body?.alsoEmail === true && target.email) {
    if (!emailConfigured()) {
      emailError = "E-maily nejsou nastavené, odkaz je jen tady na obrazovce.";
    } else {
      const result = await sendEmail({
        to: target.email,
        ...passwordResetEmail(link),
      });
      emailed = result.sent;
      emailError = result.sent ? null : (result.reason ?? "nepovedlo se odeslat");
    }
  }

  return NextResponse.json({
    ok: true,
    link,
    name: target.name,
    // An hour is plenty when the other person is in the next room, and short
    // enough that a link left on screen stops mattering quickly.
    expiresInMinutes: 60,
    emailed,
    emailError,
  });
});
