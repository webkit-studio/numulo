import { COOKIE_PATH } from "@/lib/base-path";
import { getSessionSecret } from "./secret";

export const SESSION_COOKIE = "numo_session";

/** 30 days — numo lives on a home screen and shouldn't ask twice a week. */
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
export function timingSafeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const length = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < length; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

export interface Session {
  userId: number;
  expiresAt: number;
  /** The user's session_epoch when this cookie was minted. */
  epoch: number;
}

/**
 * `{userId}.{epoch}.{expiresAtSeconds}.{signature}`
 *
 * The epoch is what makes a session revocable. A signed cookie is otherwise
 * valid for its full 30 days no matter what happens to the account, so
 * changing a password would leave every stolen cookie working — which is the
 * one thing a password change is supposed to stop.
 */
export async function createSessionToken(
  userId: number,
  epoch: number,
  now = Date.now(),
): Promise<string> {
  const expiresAt = Math.floor(now / 1000) + SESSION_TTL_SECONDS;
  const payload = `${userId}.${epoch}.${expiresAt}`;
  return `${payload}.${await hmac(await getSessionSecret(), payload)}`;
}

/** The signed-in user, or null. Never throws — a bad cookie is just no session. */
export async function readSessionToken(
  token: string | undefined,
  now = Date.now(),
): Promise<Session | null> {
  if (!token) return null;

  const separator = token.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  let expected: string;
  try {
    expected = await hmac(await getSessionSecret(), payload);
  } catch {
    return null;
  }
  if (!timingSafeEqual(signature, expected)) return null;

  const [rawUserId, rawEpoch, rawExpiry] = payload.split(".");
  const userId = Number(rawUserId);
  const epoch = Number(rawEpoch);
  const expiresAt = Number(rawExpiry);

  // Cookies minted before the epoch existed have two payload segments and land
  // here with expiresAt undefined. They are rejected rather than upgraded: the
  // whole point of the epoch is that a session predating it cannot be trusted.
  if (!Number.isInteger(userId) || !Number.isInteger(epoch)) return null;
  if (!Number.isFinite(expiresAt) || expiresAt * 1000 <= now) return null;

  return { userId, expiresAt, epoch };
}

/**
 * Confirms the cookie's epoch still matches the account's.
 *
 * Separate from `readSessionToken` because that one is pure crypto and runs in
 * tests without a database; this one needs D1 and is called wherever a request
 * is about to be trusted.
 */
export async function sessionEpochValid(session: Session): Promise<boolean> {
  const { env } = await import("@opennextjs/cloudflare").then((m) =>
    m.getCloudflareContext(),
  );
  const row = await env.DB.prepare(
    "SELECT session_epoch FROM users WHERE id = ?",
  )
    .bind(session.userId)
    .first<{ session_epoch: number }>();

  // No row means the account is gone; that is not a valid session either.
  return row ? Number(row.session_epoch) === session.epoch : false;
}

export const sessionCookieOptions = {
  httpOnly: true,
  // `next dev` serves over plain http, where a Secure cookie is dropped.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: COOKIE_PATH,
  maxAge: SESSION_TTL_SECONDS,
} as const;
