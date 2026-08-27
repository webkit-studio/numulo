import { describe, expect, it } from "vitest";
import { detectSubscriptions, simulateCancellation } from "./detect";

const charge = (merchant: string, amount: number, month: string, day?: number) => ({
  merchant,
  amount,
  month,
  day,
});

describe("detectSubscriptions", () => {
  it("finds a merchant charging the same amount three months running", () => {
    const found = detectSubscriptions([
      charge("Netflix", 27900, "2026-05", 14),
      charge("Netflix", 27900, "2026-06", 14),
      charge("Netflix", 27900, "2026-07", 15),
    ]);

    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ name: "Netflix", amount: 27900, day: 14 });
    expect(found[0].stillRunning).toBe(true);
  });

  it("ignores a merchant seen in only two months", () => {
    expect(
      detectSubscriptions([
        charge("Spotify", 19900, "2026-06"),
        charge("Spotify", 19900, "2026-07"),
      ]),
    ).toEqual([]);
  });

  it("does not mistake a shop visited weekly for a subscription", () => {
    // Same month, four visits, wildly different amounts: one month, no match.
    const found = detectSubscriptions([
      charge("Lidl", 45000, "2026-07"),
      charge("Lidl", 120000, "2026-07"),
      charge("Lidl", 31000, "2026-07"),
      charge("Lidl", 87000, "2026-07"),
    ]);
    expect(found).toEqual([]);
  });

  it("absorbs a couple of crowns of drift but splits a real price change", () => {
    const found = detectSubscriptions([
      charge("Vodafone", 50000, "2026-04"),
      charge("Vodafone", 50100, "2026-05"),
      charge("Vodafone", 49900, "2026-06"),
      charge("Vodafone", 80000, "2026-07"),
      charge("Vodafone", 80000, "2026-08"),
      charge("Vodafone", 80000, "2026-09"),
    ]);

    expect(found.map((item) => item.amount)).toEqual([80000, 50000]);
  });

  it("marks a subscription that stopped charging as no longer running", () => {
    const found = detectSubscriptions(
      [
        charge("HBO", 19900, "2026-03"),
        charge("HBO", 19900, "2026-04"),
        charge("HBO", 19900, "2026-05"),
      ],
      { latestMonth: "2026-07" },
    );

    expect(found[0].stillRunning).toBe(false);
  });

  it("puts the most expensive candidate first", () => {
    const found = detectSubscriptions([
      charge("Spotify", 19900, "2026-05"),
      charge("Spotify", 19900, "2026-06"),
      charge("Spotify", 19900, "2026-07"),
      charge("Pojištění", 120000, "2026-05"),
      charge("Pojištění", 120000, "2026-06"),
      charge("Pojištění", 120000, "2026-07"),
    ]);

    expect(found.map((item) => item.name)).toEqual(["Pojištění", "Spotify"]);
  });
});

describe("simulateCancellation", () => {
  it("adds up what the cancelled items cost per month and per year", () => {
    const items = [
      { id: 1, amount: 27900 },
      { id: 2, amount: 19900 },
      { id: 3, amount: 50000 },
    ];

    expect(simulateCancellation(items, [1, 3])).toEqual({
      monthly: 77900,
      yearly: 934800,
    });
  });

  it("frees nothing when nothing is selected", () => {
    expect(simulateCancellation([{ id: 1, amount: 100 }], [])).toEqual({
      monthly: 0,
      yearly: 0,
    });
  });
});
