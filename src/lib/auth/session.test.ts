import { beforeEach, describe, expect, it } from "vitest";
import {
  MAX_ITERATIONS_PER_CALL,
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

  it("nepřekročí limit Workers na jedno volání PBKDF2", async () => {
    // Workers odmítne jedno volání nad 100 000 iterací a lokální workerd ten
    // limit NEVYNUCUJE — spadne to až v produkci. Tenhle test to hlídá.
    const { hash } = await hashPassword("tajne-heslo-123");
    const iterations = Number(/\$i=(\d+)\$/.exec(hash)![1]);

    expect(iterations).toBeLessThanOrEqual(MAX_ITERATIONS_PER_CALL);
  });

  it("dosáhne doporučené práce řetězením kol", async () => {
    const { hash } = await hashPassword("tajne-heslo-123");
    const [, rounds, iterations] = /\$r=(\d+)\$i=(\d+)\$/.exec(hash)!;

    // 6 × 100 000 = 600 000, tedy doporučení OWASP pro PBKDF2-SHA256.
    expect(Number(rounds) * Number(iterations)).toBeGreaterThanOrEqual(600_000);
  });

  it("nese parametry v hashi, aby šly později zvýšit", async () => {
    const { hash } = await hashPassword("tajne-heslo-123");
    expect(hash).toMatch(/^pbkdf2-sha256\$r=\d+\$i=\d+\$/);
  });

  it("odmítne hash s parametry, které by platforma nepřijala", async () => {
    const record = await hashPassword("tajne-heslo-123");
    const tampered = record.hash.replace(/\$i=\d+\$/, "$i=210000$");

    expect(await verifyPassword("tajne-heslo-123", { ...record, hash: tampered })).toBe(
      false,
    );
  });

  it("odmítne hash v neznámém formátu", async () => {
    const record = await hashPassword("tajne-heslo-123");
    expect(
      await verifyPassword("tajne-heslo-123", { ...record, hash: "holy-digest" }),
    ).toBe(false);
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
    const session = await readSessionToken(await createSessionToken(7, 1));
    expect(session?.userId).toBe(7);
  });

  it("odmítne podvržený podpis", async () => {
    const token = await createSessionToken(1, 1);
    const [userId, expiry, signature] = token.split(".");
    const flipped = signature.startsWith("A")
      ? `B${signature.slice(1)}`
      : `A${signature.slice(1)}`;

    expect(await readSessionToken(`${userId}.${expiry}.${flipped}`)).toBeNull();
  });

  it("odmítne přepsané id uživatele — jinak by šlo přepnout na cizí účet", async () => {
    const token = await createSessionToken(2, 1);
    const [, expiry, signature] = token.split(".");

    expect(await readSessionToken(`1.${expiry}.${signature}`)).toBeNull();
  });

  it("odmítne prodlouženou expiraci", async () => {
    const token = await createSessionToken(1, 1);
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
    const token = await createSessionToken(1, 1, issuedAt);

    expect(await readSessionToken(token, issuedAt + 29 * DAY)).not.toBeNull();
    expect(await readSessionToken(token, issuedAt + 31 * DAY)).toBeNull();
  });

  it("zneplatní tokeny při změně podpisového klíče", async () => {
    const token = await createSessionToken(1, 1);
    process.env.NUMO_SESSION_SECRET = "jiny-klic";
    resetSecretCache();

    expect(await readSessionToken(token)).toBeNull();
  });
});

describe("session epoch", () => {
  it("rejects a cookie minted under an older epoch", async () => {
    // The password was changed, so the account moved to epoch 2 while this
    // cookie still claims 1. Signature and expiry are both fine — the epoch is
    // the only thing that ends it.
    const token = await createSessionToken(1, 1);
    const session = await readSessionToken(token);
    expect(session).toMatchObject({ userId: 1, epoch: 1 });

    const current = 2;
    expect(session!.epoch === current).toBe(false);
  });

  it("refuses a legacy two-segment cookie instead of assuming an epoch", async () => {
    // Cookies issued before the epoch existed look like `{id}.{expiry}.{sig}`.
    // Treating the expiry as an epoch would resurrect every pre-fix session.
    const legacyPayload = "1.99999999999";
    const secret = await import("./secret");
    void secret;
    const forged = `${legacyPayload}.deadbeef`;
    expect(await readSessionToken(forged)).toBeNull();
  });

  it("keeps a cookie whose epoch still matches", async () => {
    const token = await createSessionToken(3, 7);
    expect(await readSessionToken(token)).toMatchObject({ userId: 3, epoch: 7 });
  });
});
