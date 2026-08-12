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

export function emailConfigured(): boolean {
  return Boolean(getEnvVar("RESEND_API_KEY"));
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  text: string;
}): Promise<SendResult> {
  const apiKey = getEnvVar("RESEND_API_KEY");
  if (!apiKey) return { sent: false, reason: "RESEND_API_KEY není nastavený" };

  const from = getEnvVar("NUMO_MAIL_FROM") ?? "numo <onboarding@resend.dev>";

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
      return { sent: false, reason: `Resend odpověděl ${response.status}` };
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
