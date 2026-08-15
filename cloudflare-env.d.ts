/* eslint-disable @typescript-eslint/no-empty-object-type */
// Regenerate after changing bindings in wrangler.json:  npm run cf-typegen

interface CloudflareEnv {
  /** Webflow Cloud SQLite (D1) */
  DB: D1Database;
  /** Webflow Cloud Object Storage (R2) — raw CSV archive */
  IMPORTS: R2Bucket;
  /**
   * Optional cookie-signing secret. When absent, numo generates one on first
   * use and keeps it in the database, so nothing has to be configured.
   */
  NUMO_SESSION_SECRET?: string;
  /** Resend API key. Without it the "forgotten password" e-mail cannot be sent. */
  RESEND_API_KEY?: string;
  /** Sender address for those e-mails, e.g. "numo <numo@svobs.cz>". */
  NUMO_MAIL_FROM?: string;
  /** Claude API key. When absent, AI features stay hidden and the app still works. */
  ANTHROPIC_API_KEY?: string;
  /** Cloudflare Turnstile secret. Without it public registration stays closed. */
  TURNSTILE_SECRET_KEY?: string;
  /** Turnstile site key — public by design, rendered into the sign-up form. */
  NEXT_PUBLIC_TURNSTILE_SITE_KEY?: string;
}
