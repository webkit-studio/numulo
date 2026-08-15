import { getEnvVar } from "@/lib/env";

/**
 * Cloudflare Turnstile — the bot check on the registration form.
 *
 * Chosen over reCAPTCHA because the app already runs on Cloudflare, so it adds
 * no third party, no cookie, and no puzzle for the two people who actually use
 * numo.
 *
 * Without `TURNSTILE_SECRET_KEY` the check does not silently pass: registration
 * stays closed. A sign-up form with a bot check that is quietly disabled is
 * worse than no form, because nobody would ever find out.
 */

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function turnstileConfigured(): boolean {
  return Boolean(getEnvVar("TURNSTILE_SECRET_KEY") && getEnvVar("NEXT_PUBLIC_TURNSTILE_SITE_KEY"));
}

export interface TurnstileResult {
  ok: boolean;
  reason?: string;
}

export async function verifyTurnstile(
  token: string,
  ip?: string | null,
): Promise<TurnstileResult> {
  const secret = getEnvVar("TURNSTILE_SECRET_KEY");
  if (!secret) return { ok: false, reason: "Ochrana proti botům není nastavená." };
  if (!token) return { ok: false, reason: "Chybí potvrzení, že nejsi robot." };

  const body = new FormData();
  body.set("secret", secret);
  body.set("response", token);
  if (ip) body.set("remoteip", ip);

  try {
    const response = await fetch(VERIFY_URL, { method: "POST", body });
    const data = (await response.json()) as {
      success?: boolean;
      "error-codes"?: string[];
    };

    if (data.success) return { ok: true };
    return {
      ok: false,
      reason: `Ověření selhalo (${(data["error-codes"] ?? []).join(", ") || "bez důvodu"}).`,
    };
  } catch {
    // A failed check is a failed check — never a pass.
    return { ok: false, reason: "Ověření se nepodařilo spustit." };
  }
}
