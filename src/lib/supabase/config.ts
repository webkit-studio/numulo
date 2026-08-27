/**
 * ─────────────────────────────────────────────────────────────────────────────
 * The two values the app cannot start without — with the production values
 * baked in as fallbacks, deliberately.
 *
 * Both are public by design: they ride in every browser request of everyone
 * who opens the app, and row-level security is what guards the data. This app
 * has exactly one database, so its public address may live in its public code.
 *
 * The fallbacks are not laziness; they are the only shape that survives every
 * runtime this app has met. Next.js inlines `NEXT_PUBLIC_*` only into browser
 * bundles; the edge middleware reads env at run time, and Vercel's edge
 * runtime carries nothing from `.env.production`. Routing the values through
 * `env` in next.config.ts died on a restored build cache. A constant in the
 * source cannot be lost by any of that.
 *
 * The env override still wins everywhere it exists — `.env.local` for a dev
 * database, hosting env for another deployment. Without any override, local
 * dev talks to PRODUCTION: fine for this household, worth knowing out loud.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const URL_FALLBACK = "https://azsocpwpbopgzsrynxia.supabase.co";
const KEY_FALLBACK = "sb_publishable_QaGFoDeY_Rcw0n_GUjD0cw_54TmUuTi";

export const supabaseUrl = (): string =>
  process.env.NEXT_PUBLIC_SUPABASE_URL || URL_FALLBACK;
export const supabaseKey = (): string =>
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || KEY_FALLBACK;
