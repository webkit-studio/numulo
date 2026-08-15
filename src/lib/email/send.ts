import { getEnvVar } from "@/lib/env";

/**
 * Transactional e-mail through Resend.
 *
 * Without RESEND_API_KEY nothing is sent and the caller is told so — numo keeps
 * working, only the "forgotten password" link cannot be delivered.
 */

export interface SendResult {
  sent: boolean;
  reason?: string;
}

/**
 * Both halves are required. Resend's sandbox sender only delivers to the
 * account owner's own address, so defaulting to it produced a 403 at the worst
 * possible moment — someone waiting on a reset link that was never going to
 * arrive. Better to report "not configured" than to half-work.
 */
export function emailConfigured(): boolean {
  return Boolean(getEnvVar("RESEND_API_KEY") && getEnvVar("NUMO_MAIL_FROM"));
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = getEnvVar("RESEND_API_KEY");
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY není nastavený" };

  const from = getEnvVar("NUMO_MAIL_FROM");
  if (!from) {
    return {
      sent: false,
      reason:
        "NUMO_MAIL_FROM není nastavený — Resend potřebuje odesílatele z ověřené domény",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [options.to],
        subject: options.subject,
        text: options.text,
      }),
    });

    if (!response.ok) {
      // Resend explains refusals in the body — an unverified domain, a sender
      // that is not yours. Dropping it leaves a bare status code to debug from.
      const detail = await response.text().catch(() => "");
      return {
        sent: false,
        reason: `Resend odpověděl ${response.status}${detail ? `: ${detail.slice(0, 300)}` : ""}`,
      };
    }
    return { sent: true };
  } catch (error) {
    return { sent: false, reason: (error as Error).message };
  }
}

export function passwordResetEmail(link: string): {
  subject: string;
  text: string;
} {
  return {
    subject: "numo — nastavení hesla",
    text: [
      "Ahoj,",
      "",
      "tímhle odkazem si nastavíš nové heslo do numa:",
      link,
      "",
      "Odkaz platí hodinu a dá se použít jen jednou.",
      "Pokud jsi o něj nežádal(a), nic nedělej — heslo zůstane beze změny.",
    ].join("\n"),
  };
}
