/**
 * Password hashing with PBKDF2-SHA256 through Web Crypto.
 *
 * bcrypt and argon2 are native modules and do not exist on the Workers
 * runtime; PBKDF2 is what the platform actually offers.
 *
 * ── Why the rounds ──────────────────────────────────────────────────────────
 * Workers refuses a single deriveBits call above 100 000 iterations
 * ("Pbkdf2 failed: iteration counts above 100000 are not supported"), while
 * OWASP asks for 600 000 on PBKDF2-SHA256. Note that the local workerd used by
 * `wrangler dev` does NOT enforce the cap — this only fails once deployed.
 *
 * So the derivation is chained: each round feeds its output in as the next
 * round's password. An attacker has to redo every round too, so the work
 * factor multiplies and 6 × 100 000 buys the same resistance as 600 000 in one
 * call, with no single call breaking the limit.
 *
 * ── Why the parameters live in the hash ─────────────────────────────────────
 * Stored as `pbkdf2-sha256$r=<rounds>$i=<iterations>$<digest>`, so raising the
 * work factor later keeps every existing password verifiable instead of
 * locking people out.
 */

/** The platform ceiling. A single call may not exceed this. */
export const MAX_ITERATIONS_PER_CALL = 100_000;

const ROUNDS = 6;
const ITERATIONS = 100_000;
const KEY_BITS = 256;
const SALT_BYTES = 16;
const SCHEME = "pbkdf2-sha256";

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

async function deriveOnce(
  secret: BufferSource,
  salt: Uint8Array,
  iterations: number,
): Promise<Uint8Array<ArrayBuffer>> {
  const key = await crypto.subtle.importKey("raw", secret, "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: salt.slice(), iterations, hash: "SHA-256" },
    key,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

async function derive(
  password: string,
  salt: Uint8Array,
  rounds: number,
  iterations: number,
): Promise<string> {
  // Copy into a plain ArrayBuffer: TextEncoder's view is typed as possibly
  // sitting on a SharedArrayBuffer, which BufferSource does not accept.
  let block = new Uint8Array(encoder.encode(password));
  for (let round = 0; round < rounds; round++) {
    block = await deriveOnce(block, salt, iterations);
  }
  return toBase64Url(block);
}

export interface PasswordRecord {
  hash: string;
  salt: string;
}

export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const digest = await derive(password, salt, ROUNDS, ITERATIONS);
  return {
    hash: `${SCHEME}$r=${ROUNDS}$i=${ITERATIONS}$${digest}`,
    salt: toBase64Url(salt),
  };
}

interface ParsedHash {
  rounds: number;
  iterations: number;
  digest: string;
}

function parseHash(stored: string): ParsedHash | null {
  const match = /^pbkdf2-sha256\$r=(\d+)\$i=(\d+)\$(.+)$/.exec(stored);
  if (!match) return null;

  const rounds = Number(match[1]);
  const iterations = Number(match[2]);
  // Refuse parameters the platform would reject anyway, rather than throwing
  // an unhandled error deep inside a login request.
  if (!rounds || !iterations || iterations > MAX_ITERATIONS_PER_CALL) return null;

  return { rounds, iterations, digest: match[3] };
}

export async function verifyPassword(
  password: string,
  record: { hash: string | null; salt: string | null },
): Promise<boolean> {
  if (!record.hash || !record.salt) return false;

  const parsed = parseHash(record.hash);
  if (!parsed) return false;

  let candidate: string;
  try {
    candidate = await derive(
      password,
      fromBase64Url(record.salt),
      parsed.rounds,
      parsed.iterations,
    );
  } catch {
    return false;
  }

  const a = encoder.encode(candidate);
  const b = encoder.encode(parsed.digest);
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
