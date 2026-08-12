import { beforeEach, describe, expect, it } from "vitest";
import {
  hashPassword,
  normalizeEmail,
  validatePassword,
  verifyPassword,
} from "./password";
import { createSessionToken, readSessionToken } from "./session";
import { resetSecretCache } from "./secret";

const DAY = 24 * 60 * 60 * 1000;

beforeEach(() => {
  process.env.NUMO_SESSION_SECRET = "stabilni-podpisovy-klic-pro-testy";
  resetSecretCache();
});

describe("hashování hesla", () => {
  it("ověří správné heslo a odmítne špatné", async () => {
    const record = await hashPassword("tajne-heslo-123");

    expect(await verifyPassword("tajne-heslo-123", record)).toBe(true);
    expect(await verifyPassword("tajne-heslo-124", record)).toBe(false);
    expect(await verifyPassword("", record)).toBe(false);
    // Prefix nesmí projít — délka je součástí porovnání.
    expect(await verifyPassword("tajne-heslo-12", record)).toBe(false);
  });

  it("dá stejnému heslu pokaždé jiný hash (náhodná sůl)", async () => {
    const first = await hashPassword("stejne-heslo-123");
    const second = await hashPassword("stejne-heslo-123");

    expect(first.hash).not.toBe(second.hash);
    expect(first.salt).not.toBe(second.salt);
    expect(await verifyPassword("stejne-heslo-123", second)).toBe(true);
  });

  it("odmítne účet, který heslo ještě nemá", async () => {
    expect(await verifyPassword("cokoliv", { hash: null, salt: null })).toBe(
      false,
    );
  });

  it("nespadne na poškozené soli v databázi", async () => {
    const record = await hashPassword("tajne-heslo-123");
    expect(
      await verifyPassword("tajne-heslo-123", { ...record, salt: "!!!nonsense" }),
    ).toBe(false);
  });

  it("hlídá minimální délku", () => {
    expect(validatePassword("kratke")).toContain("10");
    expect(validatePassword("dost-dlouhe-heslo")).toBeNull();
    expect(validatePassword("x".repeat(500))).toContain("dlouhé");
  });

  it("normalizuje e-mail na malá písmena bez mezer", () => {
    expect(normalizeEmail("  Lukas@Svobs.CZ ")).toBe("lukas@svobs.cz");
  });
});

describe("session token", () => {
  it("nese identitu uživatele tam a zpátky", async () => {
    const session = await readSessionToken(await createSessionToken(7));
    expect(session?.userId).toBe(7);
  });

  it("odmítne podvržený podpis", async () => {
    const token = await createSessionToken(1);
    const [userId, expiry, signature] = token.split(".");
    const flipped = signature.startsWith("A")
      ? `B${signature.slice(1)}`
      : `A${signature.slice(1)}`;

    expect(await readSessionToken(`${userId}.${expiry}.${flipped}`)).toBeNull();
  });

  it("odmítne přepsané id uživatele — jinak by šlo přepnout na cizí účet", async () => {
    const token = await createSessionToken(2);
    const [, expiry, signature] = token.split(".");

    expect(await readSessionToken(`1.${expiry}.${signature}`)).toBeNull();
  });

  it("odmítne prodlouženou expiraci", async () => {
    const token = await createSessionToken(1);
    const [userId, , signature] = token.split(".");
    const farFuture = Math.floor(Date.now() / 1000) + 10 * 365 * 24 * 3600;

    expect(
      await readSessionToken(`${userId}.${farFuture}.${signature}`),
    ).toBeNull();
  });

  it("odmítne poškozené a prázdné tokeny", async () => {
    for (const token of [undefined, "", ".", "nesmysl", "1.2"]) {
      expect(await readSessionToken(token)).toBeNull();
    }
  });

  it("vyprší po 30 dnech", async () => {
    const issuedAt = Date.parse("2026-08-12T10:00:00Z");
    const token = await createSessionToken(1, issuedAt);

    expect(await readSessionToken(token, issuedAt + 29 * DAY)).not.toBeNull();
    expect(await readSessionToken(token, issuedAt + 31 * DAY)).toBeNull();
  });

  it("zneplatní tokeny při změně podpisového klíče", async () => {
    const token = await createSessionToken(1);
    process.env.NUMO_SESSION_SECRET = "jiny-klic";
    resetSecretCache();

    expect(await readSessionToken(token)).toBeNull();
  });
});
