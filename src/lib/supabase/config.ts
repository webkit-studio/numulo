/**
 * ─────────────────────────────────────────────────────────────────────────────
 * The two values the app cannot start without.
 *
 * Reading them straight out of `process.env` with a `!` compiles fine and then
 * fails at run time inside supabase-js, which throws on every single route —
 * including the login page. The result is a site that is entirely 500 and says
 * nothing about why. That happened: a deploy preview built without the
 * publishable key looked exactly like a broken app.
 *
 * So the check happens here, once, with the variable's name in the message.
 * The failure is the same failure; the difference is that it can be read.
 *
 * The literal `process.env.NEXT_PUBLIC_…` expressions below are load-bearing:
 * Next.js inlines only literal member access at build time, and the edge
 * middleware bundle has no other way to see values from `.env.production`.
 * A dynamic `process.env[name]` here means a middleware that 500s on Vercel
 * while working everywhere the runtime carries the variables. That happened
 * too.
 * ─────────────────────────────────────────────────────────────────────────────
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Chybí proměnná prostředí ${name}. ` +
        "Veřejné hodnoty patří do .env.production v repu, " +
        "lokálně do .env.local (vzor je v .env.example).",
    );
  }
  return value;
}

export const supabaseUrl = (): string =>
  required("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
export const supabaseKey = (): string =>
  required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
