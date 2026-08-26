import { createClient } from "@/lib/supabase/server";
import { supabaseUrl } from "@/lib/supabase/config";

/**
 * Talking to the ai-worker Edge Function.
 *
 * The Anthropic key lives ONLY there (Supabase → Edge Functions → Secrets),
 * so the Next app never holds it and this repo never can leak it. Every call
 * carries the signed-in person's own token — the function re-reads the job
 * with that token, which is how row-level security stays the judge of whose
 * job it is.
 */

export interface WorkerUnavailable {
  enabled: false;
  reason: string;
}

async function callerToken(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

export async function callWorker(
  body: Record<string, unknown>,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const token = await callerToken();
  if (!token) return { status: 401, body: { error: "Nejsi přihlášený." } };

  const response = await fetch(`${supabaseUrl()}/functions/v1/ai-worker`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    // A queued job answers in milliseconds; only map-columns actually waits
    // on the model, and that is a ~700-token request.
    signal: AbortSignal.timeout(9_000),
  });

  const parsed = (await response.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: response.status, body: parsed };
}

/** The message shown wherever a feature needs the key and it is not set. */
export const AI_OFF =
  "AI není zapnuté. Vytvoř klíč na console.anthropic.com a vlož ho v Supabase: " +
  "Edge Functions → Secrets → ANTHROPIC_API_KEY.";
