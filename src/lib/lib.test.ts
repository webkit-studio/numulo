import { describe, expect, it } from "vitest";
import {
  addMonths,
  daysInMonth,
  lastMonths,
  monthNumber,
  monthOf,
  monthRange,
} from "./date";
import { czkToHalere, formatCzk, parseCzkAmount } from "./money";

describe("money", () => {
  it("stores crowns as integer haléře", () => {
    expect(czkToHalere(63_000)).toBe(6_300_000);
    expect(czkToHalere(-1_234.56)).toBe(-123_456);
  });

  it("parses Czech CSV amounts with a decimal comma and space separators", () => {
    expect(parseCzkAmount("1 234,56")).toBe(123_456);
    expect(parseCzkAmount("-1 234,56")).toBe(-123_456);
    expect(parseCzkAmount("63000")).toBe(6_300_000);
    // Non-breaking and narrow no-break spaces both appear in real exports.
    expect(parseCzkAmount("12 345,00")).toBe(1_234_500);
    expect(parseCzkAmount("12 345,00")).toBe(1_234_500);
    // U+2212 MINUS SIGN, not a hyphen.
    expect(parseCzkAmount("−500,00")).toBe(-50_000);
  });

  it("rejects anything that is not a number", () => {
    expect(parseCzkAmount("")).toBeNull();
    expect(parseCzkAmount("n/a")).toBeNull();
    expect(parseCzkAmount("12,34,56")).toBeNull();
  });

  it("formats with a Czech minus sign and a non-breaking unit", () => {
    expect(formatCzk(6_300_000)).toBe("63 000 Kč");
    expect(formatCzk(-19_300_000)).toBe("−193 000 Kč");
    expect(formatCzk(6_300_000, { sign: true })).toBe("+63 000 Kč");
    expect(formatCzk(123_456, { precise: true })).toBe("1 234,56 Kč");
  });
});

describe("dates", () => {
  it("derives the month from an ISO date", () => {
    expect(monthOf("2026-08-12")).toBe("2026-08");
    expect(monthNumber("2026-08")).toBe(8);
  });

  it("crosses the year boundary in both directions", () => {
    expect(addMonths("2026-12", 1)).toBe("2027-01");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2026-08", -14)).toBe("2025-06");
    expect(addMonths("2026-08", 29)).toBe("2029-01");
  });

  it("builds inclusive ranges", () => {
    expect(monthRange("2026-11", "2027-02")).toEqual([
      "2026-11",
      "2026-12",
      "2027-01",
      "2027-02",
    ]);
    expect(lastMonths("2026-08", 6)).toEqual([
      "2026-03",
      "2026-04",
      "2026-05",
      "2026-06",
      "2026-07",
      "2026-08",
    ]);
  });

  it("knows month lengths including leap February", () => {
    expect(daysInMonth("2026-02")).toBe(28);
    expect(daysInMonth("2028-02")).toBe(29);
    expect(daysInMonth("2026-08")).toBe(31);
    expect(daysInMonth("2026-04")).toBe(30);
  });
});
