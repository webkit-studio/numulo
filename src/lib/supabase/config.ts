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
 * ─────────────────────────────────────────────────────────────────────────────
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Chybí proměnná prostředí ${name}. ` +
        "Na Netlify ji nastav v Project configuration → Environment variables, " +
        "lokálně v .env.local (vzor je v .env.example).",
    );
  }
  return value;
}

export const supabaseUrl = (): string => required("NEXT_PUBLIC_SUPABASE_URL");
export const supabaseKey = (): string => required("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
