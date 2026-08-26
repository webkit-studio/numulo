import { EMPTY_MAP, normalizeHeader, type ColumnMap } from "@/lib/import/mapping";
import { callWorker } from "./worker";

/**
 * The model may read column HEADINGS, never rows. It suggests a mapping and
 * this code keeps only the parts that name a heading which really exists —
 * an invented heading simply does not appear, and the deterministic guess
 * stays in place for that field.
 *
 * The call goes through the ai-worker Edge Function, where the Anthropic key
 * lives. No key configured → null, and the import continues on the
 * deterministic guess alone.
 */

const FIELDS: (keyof ColumnMap)[] = [
  "date", "amount", "debit", "credit", "currency",
  "description", "counterparty", "counterAccount", "vs", "card",
];

export interface ColumnGuess {
  map: ColumnMap;
  /** Tokens spent, so the cost of a feature is never a mystery. */
  tokens: { input: number; output: number };
  note: string | null;
}

export async function guessColumnsWithAi(
  headers: readonly string[],
  fallback: ColumnMap,
  instructions: string,
): Promise<ColumnGuess | null> {
  const { status, body } = await callWorker({
    task: "map-columns",
    headers,
    instructions,
  });

  if (status !== 200 || typeof body.map !== "object" || body.map === null) return null;

  const parsed = body.map as Partial<Record<keyof ColumnMap, string | null>>;
  const tokens = (body.tokens ?? { input: 0, output: 0 }) as { input: number; output: number };

  const byNormalised = new Map(headers.map((header) => [normalizeHeader(header), header]));
  const map: ColumnMap = { ...EMPTY_MAP, ...fallback };
  let changed = 0;

  for (const field of FIELDS) {
    const proposed = parsed[field];
    if (typeof proposed !== "string") continue;
    const real = byNormalised.get(normalizeHeader(proposed));
    if (!real) continue;
    if (map[field] !== real) changed += 1;
    map[field] = real;
  }

  return {
    map,
    tokens,
    note: changed > 0 ? `Sloupce dorovnal model (${changed}×)` : null,
  };
}
