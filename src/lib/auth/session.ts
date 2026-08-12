import { COOKIE_PATH } from "@/lib/base-path";
import { getEnvVar } from "@/lib/env";

export const SESSION_COOKIE = "numo_session";

/** 30 days — Věrka keeps numo on her home screen and shouldn't re-login often. */
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

const encoder = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(message),
  );
  return base64UrlEncode(new Uint8Array(signature));
}

/** Length-independent, branch-free string compare. */
function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  // Compare a fixed number of bytes so the loop count never depends on input.
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function signingSecret(): string {
  // A dedicated secret survives a password change; otherwise rotating the
  // password logs everyone out, which is an acceptable fallback.
  const secret = getEnvVar("NUMO_SESSION_SECRET") ?? getEnvVar("NUMO_PASSWORD");
  if (!secret) {
    throw new Error(
      "NUMO_PASSWORD is not set — the app cannot verify logins. " +
        "Set it in the Webflow Cloud environment variables.",
    );
  }
  return secret;
}

/** True when the submitted password matches the configured one. */
export function checkPassword(submitted: string): boolean {
  const expected = getEnvVar("NUMO_PASSWORD");
  if (!expected) return false;
  return timingSafeEqual(submitted, expected);
}

/** `{expiresAtSeconds}.{signature}` */
export async function createSessionToken(now = Date.now()): Promise<string> {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const payload = String(expiresAt);
  const signature = await hmac(signingSecret(), payload);
  return `${payload}.${signature}`;
}

export async function verifySessionToken(
  token: string | undefined,
  now = Date.now(),
): Promise<boolean> {
  if (!token) return false;
  const separator = token.lastIndexOf(".");
  if (separator <= 0) return false;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let expected: string;
  try {
    expected = await hmac(signingSecret(), payload);
  } catch {
    return false;
  }
  if (!timingSafeEqual(signature, expected)) return false;

  const expiresAt = Number(payload);
  if (!Number.isFinite(expiresAt)) return false;
  return expiresAt * 1000 > now;
}

export const sessionCookieOptions = {
  httpOnly: true,
  // `next dev` serves over plain http, where a Secure cookie is dropped.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  // Scoped to the mount path so the cookie never leaks to the rest of the site.
  path: COOKIE_PATH,
  maxAge: SESSION_TTL_SECONDS,
} as const;
