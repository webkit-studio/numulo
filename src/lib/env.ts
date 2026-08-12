import { getCloudflareContext } from "@opennextjs/cloudflare";

type NumoEnv = Partial<
  Pick<
    CloudflareEnv,
    "NUMO_PASSWORD" | "NUMO_SESSION_SECRET" | "ANTHROPIC_API_KEY"
  >
>;

/**
 * Reads a string env var. On Webflow Cloud the values arrive through the
 * Worker binding; under `next dev` and in tests they come from process.env.
 * Middleware runs in the same Worker, so this works there too.
 */
export function getEnvVar(name: keyof NumoEnv): string | undefined {
  try {
    const { env } = getCloudflareContext();
    const value = (env as NumoEnv)[name];
    if (value) return value;
  } catch {
    // No Cloudflare context (plain node, tests) — fall through.
  }
  return process.env[name];
}

/** True when the Claude API key is configured; AI features hide without it. */
export function hasAiKey(): boolean {
  return Boolean(getEnvVar("ANTHROPIC_API_KEY"));
}
