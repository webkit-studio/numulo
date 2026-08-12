/**
 * Password hashing with PBKDF2-SHA256 through Web Crypto.
 *
 * bcrypt and argon2 are native modules and do not exist on the Workers
 * runtime; PBKDF2 is what the platform actually offers. 210 000 iterations is
 * the OWASP figure for PBKDF2-SHA256.
 */

const ITERATIONS = 210_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(value: string): Uint8Array {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, "="));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function derive(password: string, salt: Uint8Array): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    {
      name: "PBKDF2",
      // BufferSource — a fresh copy keeps TS happy about ArrayBufferLike.
      salt: salt.slice(),
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    key,
    KEY_BITS,
  );
  return toBase64Url(new Uint8Array(bits));
}

export interface PasswordRecord {
  hash: string;
  salt: string;
}

export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  return { hash: await derive(password, salt), salt: toBase64Url(salt) };
}

/** Constant-time within the digest comparison; length is fixed by KEY_BITS. */
export async function verifyPassword(
  password: string,
  record: { hash: string | null; salt: string | null },
): Promise<boolean> {
  if (!record.hash || !record.salt) return false;

  let candidate: string;
  try {
    candidate = await derive(password, fromBase64Url(record.salt));
  } catch {
    return false;
  }

  const a = encoder.encode(candidate);
  const b = encoder.encode(record.hash);
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

export const PASSWORD_MIN_LENGTH = 10;

/** Returns a Czech complaint, or null when the password is acceptable. */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Heslo musí mít aspoň ${PASSWORD_MIN_LENGTH} znaků.`;
  }
  if (password.length > 200) return "Heslo je příliš dlouhé.";
  return null;
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}
