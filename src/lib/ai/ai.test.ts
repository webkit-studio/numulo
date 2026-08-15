import { describe, expect, it, vi } from "vitest";

/**
 * These tests do not call Claude. They cover the layer that has to hold when
 * the model answers badly — a column name that is not in the file, a category
 * that does not exist, a rule with an empty pattern. That code is what stands
 * between a confident wrong answer and a wrongly labelled year of statements.
 */

const answer = vi.hoisted(() => ({ value: null as unknown }));

vi.mock("./client", () => ({
  askStructured: vi.fn(async (options: { validate: (v: unknown) => unknown }) =>
    options.validate(answer.value),
  ),
  hasAiKey: () => true,
  AI_MODEL: "claude-haiku-4-5",
  AiUnavailableError: class extends Error {},
}));

const { suggestColumnMap } = await import("./map-columns");
const { interpretInstructions } = await import("./instructions");
const { suggestCategories } = await import("./categorise");

describe("suggestColumnMap", () => {
  it("keeps column names that exist in the file", async () => {
    answer.value = { date: "Datum", amount: "Částka", vs: null };
    const map = await suggestColumnMap(["Datum", "Částka"], []);
    expect(map).toMatchObject({ date: "Datum", amount: "Částka", vs: null });
  });

  it("drops a column name the file does not have", async () => {
    answer.value = { date: "Datum", amount: "Transaction Amount" };
    const map = await suggestColumnMap(["Datum", "Částka"], []);
    expect(map.date).toBe("Datum");
    expect(map.amount).toBeNull();
  });

  it("does not call out at all when there are no headers", async () => {
    answer.value = { date: "cokoliv" };
    expect(await suggestColumnMap([], [])).toMatchObject({ date: null });
  });
});

describe("interpretInstructions", () => {
  const context = { categories: ["Jídlo"], users: ["Věrka"] };

  it("passes through a well-formed rule", async () => {
    answer.value = {
      rules: [
        {
          kind: "merchant->category",
          pattern: "Lidl",
          target: "Jídlo",
          explanation: "Lidl patří do Jídla.",
        },
      ],
    };

    const rules = await interpretInstructions("Lidl je jídlo", context);
    expect(rules).toHaveLength(1);
    expect(rules[0].pattern).toBe("Lidl");
  });

  it("drops an unknown rule kind", async () => {
    answer.value = {
      rules: [
        { kind: "merchant->planet", pattern: "Lidl", target: "x", explanation: "" },
      ],
    };
    expect(await interpretInstructions("cokoliv", context)).toEqual([]);
  });

  it("drops a pattern too short to match anything but noise", async () => {
    answer.value = {
      rules: [
        { kind: "merchant->category", pattern: "a", target: "Jídlo", explanation: "" },
      ],
    };
    expect(await interpretInstructions("cokoliv", context)).toEqual([]);
  });

  it("never asks about empty instructions", async () => {
    answer.value = { rules: [{ kind: "merchant->category", pattern: "Lidl", target: "Jídlo", explanation: "" }] };
    expect(await interpretInstructions("   ", context)).toEqual([]);
  });
});

describe("suggestCategories", () => {
  const categories = [
    { id: 1, name: "Jídlo" },
    { id: 2, name: "Doprava" },
  ];

  it("resolves category names to ids", async () => {
    answer.value = {
      suggestions: [{ merchant: "Lidl", category: "Jídlo" }],
    };
    expect(await suggestCategories(["Lidl"], categories)).toEqual([
      { merchant: "Lidl", categoryId: 1 },
    ]);
  });

  it("drops a category that does not exist", async () => {
    answer.value = {
      suggestions: [{ merchant: "Lidl", category: "Zábava" }],
    };
    expect(await suggestCategories(["Lidl"], categories)).toEqual([]);
  });

  it("drops a merchant nobody asked about", async () => {
    answer.value = {
      suggestions: [{ merchant: "Kaufland", category: "Jídlo" }],
    };
    expect(await suggestCategories(["Lidl"], categories)).toEqual([]);
  });
});
