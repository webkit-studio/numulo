import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse } from "next/server";
import { BASE_PATH } from "@/lib/base-path";
import { emailConfigured } from "@/lib/email/send";
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

  // Once anyone has a password, setup is over and this stops answering.
  if (passwords && passwords.n > 0) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
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
