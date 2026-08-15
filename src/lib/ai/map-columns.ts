import { EMPTY_MAP, type ColumnMap } from "@/lib/import/mapping";
import { askStructured } from "./client";

const FIELDS = [
  "date",
  "amount",
  "debit",
  "credit",
  "currency",
  "description",
  "counterparty",
  "counterAccount",
  "vs",
  "card",
] as const;

const FIELD_HELP: Record<(typeof FIELDS)[number], string> = {
  date: "datum, kdy peníze odešly nebo přišly",
  amount: "částka se znaménkem v jednom sloupci (mínus = výdaj)",
  debit: "výdaj, když je banka dělí do dvou sloupců (bez znaménka)",
  credit: "příjem, když je banka dělí do dvou sloupců (bez znaménka)",
  currency: "měna",
  description: "popis platby, zpráva pro příjemce",
  counterparty: "jméno obchodníka nebo protistrany",
  counterAccount: "číslo protiúčtu nebo IBAN",
  vs: "variabilní symbol",
  card: "číslo nebo držitel karty",
};

/**
 * Asks Claude which column is which, when the header names are not recognised.
 *
 * This is the fallback, not the default: `guessColumnMap` handles every export
 * a Czech bank produces, costs nothing and cannot invent an answer. The model
 * sees column names and three sample values per column — the shape of the
 * data, not the household's statement — and its answer is checked against the
 * real header list before anything uses it.
 */
export async function suggestColumnMap(
  headers: readonly string[],
  samples: readonly Record<string, string>[],
): Promise<ColumnMap> {
  if (headers.length === 0) return { ...EMPTY_MAP };

  const columns = headers.map((header) => ({
    header,
    samples: samples.map((row) => row[header] ?? "").filter((value) => value !== ""),
  }));

  const answer = await askStructured<Record<string, string | null>>({
    label: `mapování sloupců (${headers.length})`,
    system:
      "Dostaneš hlavičky sloupců z bankovního CSV výpisu a pár ukázkových hodnot. " +
      "Ke každému poli numo přiřaď název sloupce, který mu odpovídá, přesně tak, " +
      "jak je v seznamu hlaviček. Když takový sloupec ve výpisu není, vrať null. " +
      "Nikdy si název sloupce nevymýšlej.",
    prompt: [
      "Pole, která numo potřebuje:",
      ...FIELDS.map((field) => `- ${field}: ${FIELD_HELP[field]}`),
      "",
      "Sloupce ve výpisu:",
      ...columns.map(
        (column) =>
          `- "${column.header}" — ukázky: ${
            column.samples.length > 0
              ? column.samples.map((value) => `"${value}"`).join(", ")
              : "(prázdné)"
          }`,
      ),
    ].join("\n"),
    schema: {
      type: "object",
      properties: Object.fromEntries(
        FIELDS.map((field) => [
          field,
          { type: ["string", "null"], enum: [...headers, null] },
        ]),
      ),
      required: [...FIELDS],
      additionalProperties: false,
    },
    validate: (value) => (value ?? {}) as Record<string, string | null>,
  });

  const allowed = new Set(headers);
  const map: ColumnMap = { ...EMPTY_MAP };

  for (const field of FIELDS) {
    const suggested = answer[field];
    // A column name that is not in the file is a hallucination — drop it and
    // leave the field unmapped rather than write a column that does not exist.
    if (typeof suggested === "string" && allowed.has(suggested)) {
      map[field] = suggested;
    }
  }

  return map;
}
