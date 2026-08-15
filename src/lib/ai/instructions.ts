import type { RuleKind } from "@/lib/rules/engine";
import { askStructured } from "./client";

export interface SuggestedRule {
  kind: RuleKind;
  pattern: string;
  /** Category name, user name, or "1"/"0" for the flag rules. */
  target: string;
  /** Plain-Czech restatement, shown next to the checkbox. */
  explanation: string;
}

const KINDS: RuleKind[] = [
  "merchant->category",
  "pattern->owner",
  "pattern->business",
  "pattern->transfer",
];

/**
 * Turns "Pokyny k souboru" into rules the household can tick.
 *
 * Someone writes "karta 4141 je Věrky, všechno z Alzy je podnikání" and gets
 * back two proposed rules. Nothing is applied here — the return value is a
 * list of suggestions, and only what gets confirmed on screen is stored.
 *
 * The model never sees a single statement row: it reads the sentence and the
 * names of the categories and people that exist. Everything else is code.
 */
export async function interpretInstructions(
  text: string,
  context: { categories: string[]; users: string[] },
): Promise<SuggestedRule[]> {
  const trimmed = text.trim();
  if (trimmed === "") return [];

  const suggestions = await askStructured<SuggestedRule[]>({
    label: "pokyny k souboru",
    system:
      "Převádíš volně psané pokyny k bankovnímu výpisu na pravidla. " +
      "Každé pravidlo má druh, vzorek (kus textu, který se hledá v názvu " +
      "obchodníka nebo v popisu) a cíl. " +
      "merchant->category: cíl je název kategorie ze seznamu. " +
      "pattern->owner: cíl je jméno člověka ze seznamu. " +
      "pattern->business: cíl je 1 (podnikání) nebo 0. " +
      "pattern->transfer: cíl je 1 (převod mezi vlastními účty) nebo 0. " +
      "Vysvětlení piš česky, jednou větou. Co v pokynech není, nevymýšlej.",
    prompt: [
      `Kategorie: ${context.categories.join(", ") || "(žádné)"}`,
      `Lidé: ${context.users.join(", ") || "(žádní)"}`,
      "",
      "Pokyny:",
      trimmed,
    ].join("\n"),
    schema: {
      type: "object",
      properties: {
        rules: {
          type: "array",
          items: {
            type: "object",
            properties: {
              kind: { type: "string", enum: KINDS },
              pattern: { type: "string" },
              target: { type: "string" },
              explanation: { type: "string" },
            },
            required: ["kind", "pattern", "target", "explanation"],
            additionalProperties: false,
          },
        },
      },
      required: ["rules"],
      additionalProperties: false,
    },
    validate: (value) => {
      const list = (value as { rules?: unknown })?.rules;
      return Array.isArray(list) ? (list as SuggestedRule[]) : [];
    },
  });

  return suggestions.filter(
    (rule) =>
      KINDS.includes(rule.kind) &&
      typeof rule.pattern === "string" &&
      rule.pattern.trim().length >= 2,
  );
}
