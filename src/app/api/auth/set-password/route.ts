import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { validatePassword } from "@/lib/auth/password";
import { consumeResetToken } from "@/lib/auth/reset-tokens";
import {
  SESSION_COOKIE,
  createSessionToken,
  sessionCookieOptions,
} from "@/lib/auth/session";
import { bootstrapOpen } from "@/lib/auth/bootstrap";
import { findUserByEmail, findUserById, setUserPassword } from "@/lib/auth/users";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Sets a password, either from a reset link or during first-run bootstrap.
 *
 * ── The bootstrap branch is the dangerous one ──────────────────────────────
 * With no token, identity comes entirely from the client-supplied e-mail. The
 * only thing standing between a stranger and a household's bank history is
 * whether that address happens to have a password yet — and the addresses are
 * committed in a migration. So the branch is now allowed only while the whole
 * deployment is still unclaimed: the moment anyone sets a first password, it
 * shuts for everyone, permanently.
 *
 * That leaves a real question: how does the *second* person onboard? Not here.
 * From inside, by someone already signed in — see /api/auth/member-link. An
 * authenticated household member issuing a link is a decision by someone who
 * demonstrably belongs; an unauthenticated POST naming an e-mail is not.
 */
export const POST = withJsonErrors(async (request: NextRequest) => {
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
        {
          error:
            "Odkaz už neplatí — platí hodinu a jde použít jednou. " +
            "Nech si poslat nový, nebo o něj požádej někoho, kdo je v numo přihlášený.",
        },
        { status: 400 },
      );
    }
  } else {
    if (!(await bootstrapOpen(db))) {
      return NextResponse.json(
        {
          error:
            "Heslo takhle nastavit nejde — numo už někdo používá. " +
            "Odkaz na nastavení hesla ti pošle nebo ukáže někdo, kdo je uvnitř.",
        },
        { status: 403 },
      );
    }

    const user = await findUserByEmail(db, email);
    if (!user || user.passwordSetAt) {
      return NextResponse.json(
        { error: "Tenhle e-mail heslo takhle nastavit nemůže." },
        { status: 400 },
      );
    }
    userId = user.id;
    console.log(`[numo] první heslo v této instalaci — uživatel ${userId}`);
  }

  const epoch = await setUserPassword(db, userId, password);

  const user = await findUserById(db, userId);
  const response = NextResponse.json({
    ok: true,
    user: { id: userId, name: user?.name ?? null },
  });
  response.cookies.set(
    SESSION_COOKIE,
    await createSessionToken(userId, epoch),
    sessionCookieOptions,
  );
  return response;
});
