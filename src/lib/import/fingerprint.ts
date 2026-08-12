/**
 * The dedup key. Two rows with the same fingerprint are the same transaction
 * and the second one is dropped by `ON CONFLICT DO NOTHING`.
 *
 * ── Why there is an occurrence index ────────────────────────────────────────
 * The obvious composition — date, amount, currency, counterparty account, VS,
 * normalised description — collapses genuinely distinct transactions. In the
 * master CSV, 16 groups covering 33 rows are byte-identical in *every* column:
 * two or three tram tickets bought on the same day for the same amount at the
 * same stop. Nothing in the data separates them.
 *
 * Without a tiebreaker, importing that file silently drops 17 real payments
 * and the monthly totals quietly stop matching the bank. So identical rows get
 * a running index within their group: the first is 0, the second 1, and so on.
 *
 * Idempotence survives, which is the point of the fingerprint: the same file
 * parsed again yields the same groups in the same order, so the same indices,
 * so the same fingerprints, so zero rows added.
 */

export interface FingerprintParts {
  /** ISO date, YYYY-MM-DD. */
  date: string;
  /** Haléře, signed. */
  amount: number;
  currency: string;
  /** Counterparty account number, empty when the export has none. */
  counterAccount: string;
  /** Variabilní symbol, empty when absent. */
  vs: string;
  /** Description, already collapsed and lowercased. */
  normalizedDescription: string;
  /**
   * Which of the household's own accounts the row belongs to. Without it, the
   * same payment landing on two tracked accounts would dedup against itself.
   */
  ownAccount: string;
}

/** The exact string that gets hashed. Kept separate so tests can read it. */
export function fingerprintKey(
  parts: FingerprintParts,
  occurrence: number,
): string {
  return [
    parts.date,
    String(parts.amount),
    parts.currency,
    parts.counterAccount,
    parts.vs,
    parts.normalizedDescription,
    parts.ownAccount,
    String(occurrence),
  ].join("|");
}

const encoder = new TextEncoder();

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function fingerprintOf(
  parts: FingerprintParts,
  occurrence: number,
): Promise<string> {
  return sha256Hex(fingerprintKey(parts, occurrence));
}

/**
 * Fingerprints a whole file at once, assigning occurrence indices per group of
 * otherwise-identical rows. Order matters and is taken from the file — which is
 * stable for a re-export of a closed period.
 */
export async function fingerprintAll(
  rows: readonly FingerprintParts[],
): Promise<string[]> {
  const seen = new Map<string, number>();
  const result: string[] = [];

  for (const row of rows) {
    const groupKey = fingerprintKey(row, 0);
    const occurrence = seen.get(groupKey) ?? 0;
    seen.set(groupKey, occurrence + 1);
    result.push(await fingerprintOf(row, occurrence));
  }

  return result;
}
