import type { CookieOptions } from "@supabase/ssr";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * How the session cookie is written.
 *
 * @supabase/ssr leaves this cookie readable by scripts on purpose: in the usual
 * setup a browser-side Supabase client has to read the session out of it.
 * Numulo has no browser-side client — every read and write goes through a
 * Server Component or a Server Action — so nothing in the page has any reason
 * to see it, and `httpOnly` closes the door that a single XSS would otherwise
 * walk through carrying a family's bank statements.
 *
 * `secure` is conditional only so `npm run dev` over plain http keeps working;
 * anywhere else the cookie refuses to travel unencrypted.
 * ─────────────────────────────────────────────────────────────────────────────
 */
export function sessionCookieOptions(options: CookieOptions = {}): CookieOptions {
  return {
    ...options,
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  };
}
