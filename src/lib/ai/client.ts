import Anthropic from "@anthropic-ai/sdk";
import { getEnvVar, hasAiKey } from "@/lib/env";

/**
 * The one place the Claude API is reached from.
 *
 * Two rules from the brief hold everywhere below:
 *  1. Server-side only. The key never crosses to the browser, so no component
 *     imports this file — routes do.
 *  2. The model maps and suggests; it never parses data rows. Every function
 *     here takes a short list of *labels* (column headers, merchant names) and
 *     gets back *labels*, which code then applies to the rows itself.
 */

/** Cheap and quick — this workload is classification, not reasoning. */
export const AI_MODEL = "claude-haiku-4-5";

export { hasAiKey };

export class AiUnavailableError extends Error {
  constructor() {
    super("AI není nastavená — chybí ANTHROPIC_API_KEY.");
    this.name = "AiUnavailableError";
  }
}

function client(): Anthropic {
  const apiKey = getEnvVar("ANTHROPIC_API_KEY");
  if (!apiKey) throw new AiUnavailableError();
  return new Anthropic({ apiKey });
}

/** Haiku is fast; a stuck request should fail rather than hang the screen. */
const TIMEOUT_MS = 60_000;

interface AskOptions<T> {
  /** What the task is — kept short, the schema carries the output shape. */
  system: string;
  prompt: string;
  schema: Record<string, unknown>;
  maxTokens?: number;
  /** Appears in the token log so spend can be attributed per feature. */
  label: string;
  validate: (value: unknown) => T;
}

/**
 * Asks Claude for one structured answer.
 *
 * `output_config.format` constrains the reply to the schema, so there is no
 * brittle text parsing — but `validate` still runs, because a schema-valid
 * answer can still name a category that does not exist.
 */
export async function askStructured<T>({
  system,
  prompt,
  schema,
  maxTokens = 4096,
  label,
  validate,
}: AskOptions<T>): Promise<T> {
  const started = Date.now();

  const response = await client().messages.create(
    {
      model: AI_MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: prompt }],
      output_config: { format: { type: "json_schema", schema } },
    },
    { timeout: TIMEOUT_MS },
  );

  logSpend(label, response.usage, Date.now() - started);

  const text = response.content
    .map((block) => (block.type === "text" ? block.text : ""))
    .join("")
    .trim();

  if (text === "") throw new Error("AI nevrátila odpověď.");

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("AI vrátila něco, co není JSON.");
  }

  return validate(parsed);
}

interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_read_input_tokens?: number | null;
  cache_creation_input_tokens?: number | null;
}

/** Haiku 4.5 list price, USD per million tokens. */
const PRICE_IN = 1.0;
const PRICE_OUT = 5.0;

/** The brief asks for spend in the console — an unwatched bill is the worry. */
function logSpend(label: string, usage: Usage, ms: number): void {
  const cost =
    (usage.input_tokens / 1_000_000) * PRICE_IN +
    (usage.output_tokens / 1_000_000) * PRICE_OUT;

  console.log(
    `[numo/ai] ${label} · ${AI_MODEL} · vstup ${usage.input_tokens} + výstup ${usage.output_tokens} tokenů` +
      ` · ~$${cost.toFixed(4)} · ${ms} ms`,
  );
}
