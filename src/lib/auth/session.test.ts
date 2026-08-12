import { beforeEach, describe, expect, it } from "vitest";
import {
  checkPassword,
  createSessionToken,
  verifySessionToken,
} from "./session";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  process.env.NUMO_PASSWORD = "spravne-heslo";
  delete process.env.NUMO_SESSION_SECRET;
});

describe("password check", () => {
  it("accepts the configured password and nothing else", () => {
    expect(checkPassword("spravne-heslo")).toBe(true);
    expect(checkPassword("spatne-heslo")).toBe(false);
    expect(checkPassword("")).toBe(false);
    // A prefix must not pass — the length is part of the comparison.
    expect(checkPassword("spravne")).toBe(false);
    expect(checkPassword("spravne-heslo-navic")).toBe(false);
  });

  it("refuses every password when none is configured", () => {
    delete process.env.NUMO_PASSWORD;
    expect(checkPassword("")).toBe(false);
    expect(checkPassword("cokoliv")).toBe(false);
  });
});

describe("session token", () => {
  it("round-trips a freshly issued token", async () => {
    expect(await verifySessionToken(await createSessionToken())).toBe(true);
  });

  it("rejects a token whose signature was tampered with", async () => {
    const token = await createSessionToken();
    const [payload, signature] = token.split(".");
    const flipped = signature.startsWith("A")
      ? `B${signature.slice(1)}`
      : `A${signature.slice(1)}`;

    expect(await verifySessionToken(`${payload}.${flipped}`)).toBe(false);
  });

  it("rejects a token whose expiry was pushed out", async () => {
    const token = await createSessionToken();
    const signature = token.split(".")[1];
    const farFuture = Math.floor(Date.now() / 1000) + 10 * 365 * DAY;

    expect(await verifySessionToken(`${farFuture}.${signature}`)).toBe(false);
  });

  it("rejects malformed and empty tokens", async () => {
    for (const token of [undefined, "", ".", "nonsense", "123456789"]) {
      expect(await verifySessionToken(token)).toBe(false);
    }
  });

  it("expires after 30 days", async () => {
    const issuedAt = Date.parse("2026-08-12T10:00:00Z");
    const token = await createSessionToken(issuedAt);

    expect(await verifySessionToken(token, issuedAt + 29 * DAY)).toBe(true);
    expect(await verifySessionToken(token, issuedAt + 31 * DAY)).toBe(false);
  });

  it("invalidates old sessions when the password changes", async () => {
    const token = await createSessionToken();
    process.env.NUMO_PASSWORD = "nove-heslo";

    expect(await verifySessionToken(token)).toBe(false);
  });

  it("survives a password change when a dedicated secret is set", async () => {
    process.env.NUMO_SESSION_SECRET = "stabilni-podpisovy-klic";
    const token = await createSessionToken();
    process.env.NUMO_PASSWORD = "nove-heslo";

    expect(await verifySessionToken(token)).toBe(true);
  });
});
