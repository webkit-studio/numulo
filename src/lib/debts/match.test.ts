import { describe, expect, it } from "vitest";
import { matchDebtPayments } from "./match";

const debt = {
  id: 7,
  creditor: "Táta",
  targetAccount: "2053627033/5500",
  vs: "202605",
  active: true,
};

const tx = (over: Partial<Parameters<typeof matchDebtPayments>[0][number]> = {}) => ({
  id: 1,
  date: "2026-05-14",
  amount: -500000,
  merchant: "SPLÁTKA DLUHU",
  description: "SPLÁTKA DLUHU 05/2026, VS 202605",
  ...over,
});

describe("matchDebtPayments", () => {
  it("matches on the variable symbol", () => {
    const [match] = matchDebtPayments([tx()], [debt]);
    expect(match).toMatchObject({ debtId: 7, amount: 500000, reason: "vs" });
  });

  it("matches on the account number regardless of how it is punctuated", () => {
    const [match] = matchDebtPayments(
      [tx({ description: "Platba na 2053627033 / 5500" })],
      [debt],
    );
    expect(match).toMatchObject({ debtId: 7, reason: "ucet" });
  });

  it("ignores incoming money", () => {
    expect(matchDebtPayments([tx({ amount: 500000 })], [debt])).toEqual([]);
  });

  it("ignores a debt that is already settled", () => {
    expect(matchDebtPayments([tx()], [{ ...debt, active: false }])).toEqual([]);
  });

  it("does not match on the creditor's name alone", () => {
    expect(
      matchDebtPayments(
        [tx({ merchant: "Táta", description: "SPLÁTKA DLUHU" })],
        [debt],
      ),
    ).toEqual([]);
  });

  it("does not match a debt with neither symbol nor account", () => {
    expect(
      matchDebtPayments([tx()], [{ ...debt, vs: null, targetAccount: null }]),
    ).toEqual([]);
  });

  it("credits each payment to at most one debt", () => {
    const other = { ...debt, id: 9, vs: "202605", targetAccount: null };
    const matches = matchDebtPayments([tx()], [debt, other]);
    expect(matches).toHaveLength(1);
  });

  it("tolerates leading zeros in the printed symbol", () => {
    const [match] = matchDebtPayments(
      [tx({ description: "SPLATKA VS 0202605" })],
      [debt],
    );
    expect(match?.reason).toBe("vs");
  });
});
