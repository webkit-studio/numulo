import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Where Supabase sends people back after they click a link in an e-mail —
 * confirming a new account or starting a password reset.
 *
 * The code in the URL is exchanged for a session here, server-side, so the
 * token never has to survive a round trip through client JavaScript.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(`${origin}/prihlaseni?chyba=odkaz`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    // Expired or already used. Say which, rather than dropping them on a
    // login form with no explanation for why the link did nothing.
    return NextResponse.redirect(`${origin}/prihlaseni?chyba=odkaz`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
