import Anthropic from "@anthropic-ai/sdk";
import { EMPTY_MAP, normalizeHeader, type ColumnMap } from "@/lib/import/mapping";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * The one thing a model is allowed to do here: read column headings.
 *
 * It never sees a payment. The prompt carries the header row, the household's
 * own note about the file ("karta 4321 je Věrky"), and nothing else — no
 * amounts, no merchants, no dates. What comes back is a mapping from headings
 * to fields, which the code then checks against the headings it actually has
 * and discards anything that does not match.
 *
 * That boundary is the point. A model that maps columns can be wrong in a way
 * that is visible and correctable; a model that parses rows can be wrong in a
 * way nobody notices until the totals are off.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const aiEnabled = (): boolean => Boolean(process.env.ANTHROPIC_API_KEY);

const MODEL = "claude-haiku-4-5";

const FIELDS: (keyof ColumnMap)[] = [
  "date", "amount", "debit", "credit", "currency",
  "description", "counterparty", "counterAccount", "vs", "card",
];

const SCHEMA = {
  type: "object" as const,
  properties: Object.fromEntries(
    FIELDS.map((field) => [
      field,
      { type: ["string", "null"], description: `Přesný nadpis sloupce pro ${field}, nebo null.` },
    ]),
  ),
  required: FIELDS,
  additionalProperties: false,
};

export interface ColumnGuess {
  map: ColumnMap;
  /** Tokens spent, so the cost of a feature is never a mystery. */
  tokens: { input: number; output: number };
  note: string | null;
}

/**
 * Asks for a column map, then keeps only the parts that survive checking.
 *
 * Everything the model returns is verified against the real header list before
 * it is used — a heading it invented simply does not appear, and the
 * deterministic guess stays in place for that field.
 */
export async function guessColumnsWithAi(
  headers: readonly string[],
  fallback: ColumnMap,
  instructions: string,
): Promise<ColumnGuess | null> {
  if (!aiEnabled()) return null;

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 700,
    system:
      "Mapuješ nadpisy sloupců bankovního výpisu na pole. Dostáváš POUZE nadpisy, " +
      "nikdy data. Vracíš přesné znění nadpisu, nebo null, když sloupec chybí. " +
      "amount = jeden sloupec se znaménkem; debit/credit = rozdělený zápis. " +
      "Nikdy si nevymýšlej nadpis, který v seznamu není.",
    messages: [
      {
        role: "user",
        content: [
          `Nadpisy sloupců: ${JSON.stringify(headers)}`,
          instructions.trim() ? `Poznámka od uživatele: ${instructions.trim()}` : null,
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    output_config: { format: { type: "json_schema", schema: SCHEMA } },
  });

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("");

  let parsed: Partial<Record<keyof ColumnMap, string | null>>;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }

  // Only headings that genuinely exist in the file, compared the same way the
  // deterministic guesser compares them.
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
    tokens: { input: response.usage.input_tokens, output: response.usage.output_tokens },
    note: changed > 0 ? `Sloupce dorovnal model (${changed}×)` : null,
  };
}
