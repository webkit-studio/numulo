import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getEnvVar } from "@/lib/env";

const CONFIG_KEY = "session_secret";

/** Per-isolate cache — the secret never changes once generated. */
let cached: string | null = null;

function randomSecret(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The key that signs session cookies.
 *
 * Prefers NUMO_SESSION_SECRET, but generates and stores one on first use so
 * the app works with nothing configured. Reads go through the D1 binding
 * directly rather than Drizzle — this runs in middleware on every request that
 * misses the cache, and the query is a single primary-key lookup.
 */
export async function getSessionSecret(): Promise<string> {
  if (cached) return cached;

  const configured = getEnvVar("NUMO_SESSION_SECRET");
  if (configured) {
    cached = configured;
    return cached;
  }

  const { env } = getCloudflareContext();
  const existing = await env.DB.prepare(
    "SELECT value FROM app_config WHERE key = ?",
  )
    .bind(CONFIG_KEY)
    .first<{ value: string }>();

  if (existing?.value) {
    cached = existing.value;
    return cached;
  }

  const generated = randomSecret();
  // Two isolates racing here both write; INSERT OR IGNORE means the first one
  // wins and the loser reads the winner's value back.
  await env.DB.prepare(
    "INSERT OR IGNORE INTO app_config (key, value) VALUES (?, ?)",
  )
    .bind(CONFIG_KEY, generated)
    .run();

  const stored = await env.DB.prepare(
    "SELECT value FROM app_config WHERE key = ?",
  )
    .bind(CONFIG_KEY)
    .first<{ value: string }>();

  cached = stored?.value ?? generated;
  return cached;
}

/** Tests only — drops the isolate cache. */
export function resetSecretCache(): void {
  cached = null;
}
