import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { issueResetToken } from "@/lib/auth/reset-tokens";
import { findUserByEmail } from "@/lib/auth/users";
import { BASE_PATH } from "@/lib/base-path";
import { emailConfigured, passwordResetEmail, sendEmail } from "@/lib/email/send";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * "Set or forget password". Three outcomes:
 *
 *  - unknown e-mail        → reports `sent`, so the form cannot be used to
 *                            discover who has an account here
 *  - known, no password yet → `bootstrap`: the person may set one directly.
 *                            This is how the very first login happens, before
 *                            any mail is configured. It closes permanently
 *                            once a password exists.
 *  - known, has a password  → e-mails a single-use link
 */
export const POST = withJsonErrors(async (request: NextRequest) => {
  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    if (typeof body.email === "string") email = body.email;
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const db = getDb();
  const user = await findUserByEmail(db, email);

  if (!user) return NextResponse.json({ sent: true });
  if (!user.passwordSetAt) return NextResponse.json({ bootstrap: true });

  if (!emailConfigured()) {
    return NextResponse.json(
      {
        sent: false,
        error:
          "Odesílání e-mailů není nastavené — chybí RESEND_API_KEY. " +
          "Bez něj odkaz na obnovu hesla nedorazí.",
      },
      { status: 503 },
    );
  }

  const token = await issueResetToken(db, user.id);
  const origin = new URL(request.url).origin;
  const link = `${origin}${BASE_PATH}/heslo?token=${token}`;
  const result = await sendEmail({
    to: user.email!,
    ...passwordResetEmail(link),
  });

  if (!result.sent) {
    return NextResponse.json(
      { sent: false, error: `E-mail se nepodařilo odeslat: ${result.reason}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ sent: true });
});
