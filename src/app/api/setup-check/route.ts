import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { BASE_PATH } from "@/lib/base-path";
import { emailConfigured } from "@/lib/email/send";
import { hasAiKey, hasTurnstile } from "@/lib/env";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Setup-time diagnostics, reachable without a session — during setup nobody
 * can log in yet, so a gated health check is useless exactly when it is needed.
 *
 * It closes itself the moment the first password exists, and it only ever
 * reports structure (does this table exist, did the migration run) plus counts.
 * No transaction data, no e-mail addresses, no secrets.
 */
export const GET = withJsonErrors(async () => {
  const { env } = getCloudflareContext();

  const passwords = await env.DB.prepare(
    "SELECT COUNT(*) AS n FROM users WHERE password_set_at IS NOT NULL",
  )
    .first<{ n: number }>()
    .catch(() => null);

  const claimed = Boolean(passwords && passwords.n > 0);

  /**
   * Once the install is claimed this answers a deliberately narrow question:
   * is the deployment wired up? No table names, no column lists, no counts —
   * just the handful of booleans that distinguish "the e-mail service is not
   * configured" from "the base path is wrong" from "the migration never ran".
   *
   * It used to 404 here instead. That hid the only diagnostic the owner can
   * reach at exactly the moment they are locked out and need it, and hiding it
   * protected nothing: none of these booleans help an attacker who cannot get
   * a session anyway.
   */
  if (claimed) {
    return NextResponse.json({
      claimed: true,
      basePath: BASE_PATH || "/",
      emailSending: emailConfigured() ? "configured" : "absent",
      botProtection: hasTurnstile() ? "configured" : "absent",
      ai: hasAiKey() ? "configured" : "absent",
      hint:
        "Zapomenuté heslo bez nastavených e-mailů vyřeší někdo, kdo je " +
        "v numo přihlášený: Nastavení → Heslo a přístup → Vyrobit odkaz.",
    });
  }

  const tables = await env.DB.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name",
  ).all<{ name: string }>();
  const tableNames = tables.results.map((row) => row.name);

  const userColumns = await env.DB.prepare(
    "SELECT name FROM pragma_table_info('users')",
  ).all<{ name: string }>();

  let appConfigWritable: boolean;
  let appConfigError: string | null = null;
  try {
    await env.DB.prepare(
      "INSERT OR IGNORE INTO app_config (key, value) VALUES ('setup_check', 'ok')",
    ).run();
    appConfigWritable = true;
  } catch (error) {
    appConfigWritable = false;
    appConfigError = (error as Error).message;
  }

  const counts = await env.DB.prepare(
    "SELECT (SELECT COUNT(*) FROM users) AS users," +
      " (SELECT COUNT(*) FROM accounts) AS accounts," +
      " (SELECT COUNT(*) FROM categories) AS categories," +
      " (SELECT COUNT(*) FROM transactions) AS transactions",
  )
    .first()
    .catch((error: Error) => ({ error: error.message }));

  return NextResponse.json({
    setupPhase: true,
    basePath: BASE_PATH || "(kořen)",
    migrations: {
      // Everything migration 0001 is responsible for.
      appConfigTable: tableNames.includes("app_config"),
      passwordResetTokensTable: tableNames.includes("password_reset_tokens"),
      usersEmailColumn: userColumns.results.some((c) => c.name === "email"),
      usersPasswordColumns: userColumns.results.some(
        (c) => c.name === "password_hash",
      ),
    },
    appConfigWritable,
    appConfigError,
    emailSending: emailConfigured() ? "configured" : "absent",
    tables: tableNames,
    counts,
  });
});
