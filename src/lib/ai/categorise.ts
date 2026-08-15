import { askStructured } from "./client";

export interface CategorySuggestion {
  merchant: string;
  categoryId: number;
}

interface Category {
  id: number;
  name: string;
}

/**
 * Sends merchant *names* and category *names*, gets name pairs back.
 *
 * The model never sees amounts, dates or account numbers — a shop name is
 * enough to guess "Lidl → Jídlo", and sending less means the household's
 * statement never leaves the machine. Ids are resolved here, so a hallucinated
 * category simply drops out instead of writing a bad row.
 */
export async function suggestCategories(
  merchants: string[],
  categories: Category[],
): Promise<CategorySuggestion[]> {
  if (merchants.length === 0 || categories.length === 0) return [];

  const names = categories.map((category) => category.name);
  const byName = new Map(
    categories.map((category) => [category.name.toLowerCase(), category.id]),
  );

  const suggestions = await askStructured<{ merchant: string; category: string }[]>({
    label: `kategorie ×${merchants.length}`,
    system:
      "Třídíš výdaje české domácnosti do kategorií. Dostaneš názvy obchodníků, " +
      "tak jak je vypsala banka, a seznam povolených kategorií. " +
      "Ke každému obchodníkovi vyber právě jednu kategorii ze seznamu. " +
      "Když si nejsi jistý, obchodníka vynech — je lepší nic než špatně.",
    prompt: [
      `Povolené kategorie: ${names.join(", ")}`,
      "",
      "Obchodníci:",
      ...merchants.map((merchant) => `- ${merchant}`),
    ].join("\n"),
    schema: {
      type: "object",
      properties: {
        suggestions: {
          type: "array",
          items: {
            type: "object",
            properties: {
              merchant: { type: "string" },
              category: { type: "string", enum: names },
            },
            required: ["merchant", "category"],
            additionalProperties: false,
          },
        },
      },
      required: ["suggestions"],
      additionalProperties: false,
    },
    validate: (value) => {
      const list = (value as { suggestions?: unknown })?.suggestions;
      return Array.isArray(list) ? (list as { merchant: string; category: string }[]) : [];
    },
  });

  const wanted = new Set(merchants);
  const out: CategorySuggestion[] = [];

  for (const item of suggestions) {
    // Only merchants we asked about, only categories that exist.
    if (!wanted.has(item.merchant)) continue;
    const categoryId = byName.get(String(item.category).toLowerCase());
    if (categoryId === undefined) continue;
    out.push({ merchant: item.merchant, categoryId });
  }

  return out;
}
