/* eslint-disable @typescript-eslint/no-empty-object-type */
// Regenerate after changing bindings in wrangler.json:  npm run cf-typegen

interface CloudflareEnv {
  /** Webflow Cloud SQLite (D1) */
  DB: D1Database;
  /** Webflow Cloud Object Storage (R2) — raw CSV archive */
  IMPORTS: R2Bucket;
  /** Shared household password for the login gate. Set in the Webflow Cloud UI. */
  NUMO_PASSWORD?: string;
  /** Optional: dedicated cookie-signing secret. Falls back to NUMO_PASSWORD. */
  NUMO_SESSION_SECRET?: string;
  /** Claude API key. When absent, AI features stay hidden and the app still works. */
  ANTHROPIC_API_KEY?: string;
}
