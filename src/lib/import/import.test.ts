import { describe, expect, it } from "vitest";
import { czkToHalere as czk } from "@/lib/money";
import { fingerprintAll, fingerprintKey } from "./fingerprint";
import { monthlyTotals, parseMasterCsv } from "./parse";
import { normalizeMasterRow } from "./master-csv";

const HEADER =
  "datum;datum_provedeni;obdobi;ucet_cislo;ucet_nazev;typ;protistrana;popis;karta;kdo;protiucet;castka;poplatek;castka_celkem;interni_prevod;zdroj_souboru";

const row = (fields: Partial<Record<string, string>>): string =>
  [
    fields.datum ?? "2026-01-14",
    fields.datum_provedeni ?? "2026-01-12",
    fields.obdobi ?? "2026-01",
    fields.ucet_cislo ?? "2053627017",
    fields.ucet_nazev ?? "Společný účet 1",
    fields.typ ?? "Platba kartou",
    fields.protistrana ?? "Lukáš Svoboda",
    fields.popis ?? "PIDLitacka jizdne Plynarni 1617/10, Praha 7",
    fields.karta ?? "516844******2137",
    fields.kdo ?? "Lukáš",
    fields.protiucet ?? "",
    fields.castka ?? "-24.00",
    fields.poplatek ?? "0.00",
    fields.castka_celkem ?? "-24.00",
    fields.interni_prevod ?? "ne",
    fields.zdroj_souboru ?? "Vypis.pdf",
  ].join(";");

const csv = (...rows: string[]) => [HEADER, ...rows].join("\r\n");

describe("normalizace řádku", () => {
  it("bere castka_celkem, aby se neztratil poplatek za výběr", () => {
    const result = normalizeMasterRow(
      Object.fromEntries(
        HEADER.split(";").map((key, index) => [
          key,
          row({
            typ: "Výběr hotovosti",
            castka: "-1200.00",
            poplatek: "-35.00",
            castka_celkem: "-1235.00",
          }).split(";")[index],
        ]),
      ),
      2,
    );

    expect("amount" in result && result.amount).toBe(czk(-1235));
  });

  it("odvodí vlastníka z karty, když sloupec kdo chybí", async () => {
    const { rows } = await parseMasterCsv(csv(row({ kdo: "" })));
    expect(rows[0].ownerName).toBe("Lukáš");
  });

  it("nechá vlastníka prázdného, když není kdo ani karta", async () => {
    const { rows } = await parseMasterCsv(
      csv(row({ kdo: "", karta: "", typ: "Příchozí úhrada" })),
    );
    expect(rows[0].ownerName).toBeNull();
  });

  it("bere obchodníka z popisu u karet a z protistrany u převodů", async () => {
    const { rows } = await parseMasterCsv(
      csv(
        row({ popis: "Penny Jedlickova 1805, Lysa nad Labem, 28922, CZE" }),
        row({
          typ: "Trvalý příkaz",
          protistrana: "ČEZ - Záloha na elektřinu",
          popis: "VS7456781600",
        }),
      ),
    );

    // U karty je protistrana držitel karty, ne obchod — proto popis.
    expect(rows[0].merchant).toBe("Penny Jedlickova 1805");
    expect(rows[1].merchant).toBe("ČEZ - Záloha na elektřinu");
  });

  it("vytáhne VS z textu popisu", async () => {
    const { rows } = await parseMasterCsv(
      csv(row({ typ: "Trvalý příkaz", popis: "VS1318125271 Přeji hezký den" })),
    );
    expect(rows[0].vs).toBe("1318125271");
  });

  it("označí interní převod", async () => {
    const { rows } = await parseMasterCsv(
      csv(row({ interni_prevod: "ano" }), row({ interni_prevod: "ne" })),
    );
    expect(rows.map((r) => r.isTransfer)).toEqual([true, false]);
  });

  it("přiřadí Jídlo podle účtu, který na nic jiného není", async () => {
    const { rows } = await parseMasterCsv(
      csv(row({ ucet_cislo: "2053627033" }), row({ ucet_cislo: "2053627017" })),
    );
    expect(rows.map((r) => r.categoryName)).toEqual(["Jídlo", null]);
  });

  it("odloží vadný řádek místo pádu celého importu", async () => {
    const { rows, errors } = await parseMasterCsv(
      csv(row({}), row({ datum: "14.1.2026" }), row({ castka_celkem: "n/a" })),
    );
    expect(rows).toHaveLength(1);
    expect(errors).toHaveLength(2);
    expect(errors[0].reason).toContain("datum");
    expect(errors[1].reason).toContain("částka");
  });

  it("odstraní BOM, jinak by první sloupec nešel najít", async () => {
    const { rows, errors } = await parseMasterCsv("﻿" + csv(row({})));
    expect(errors).toHaveLength(0);
    expect(rows[0].date).toBe("2026-01-14");
  });
});

describe("fingerprint", () => {
  it("odliší dvě identické jízdenky ze stejného dne", async () => {
    const { rows } = await parseMasterCsv(csv(row({}), row({}), row({})));
    expect(new Set(rows.map((r) => r.fingerprint)).size).toBe(3);
  });

  it("dá stejnému souboru stejné fingerprinty (idempotence)", async () => {
    const text = csv(row({}), row({}), row({ castka_celkem: "-36.00" }));
    const first = await parseMasterCsv(text);
    const second = await parseMasterCsv(text);
    expect(first.rows.map((r) => r.fingerprint)).toEqual(
      second.rows.map((r) => r.fingerprint),
    );
  });

  it("nesplete stejnou platbu na dvou vlastních účtech", async () => {
    const { rows } = await parseMasterCsv(
      csv(row({ ucet_cislo: "2053627017" }), row({ ucet_cislo: "2840679019" })),
    );
    expect(rows[0].fingerprint).not.toBe(rows[1].fingerprint);
  });

  it("promítne do klíče všechny rozlišující složky", () => {
    const parts = {
      date: "2026-01-14",
      amount: -2400,
      currency: "CZK",
      counterAccount: "2053627017/3030",
      vs: "1318125271",
      normalizedDescription: "pidlitacka jizdne",
      ownAccount: "2053627017",
    };
    expect(fingerprintKey(parts, 0)).toBe(
      "2026-01-14|-2400|CZK|2053627017/3030|1318125271|pidlitacka jizdne|2053627017|0",
    );
  });

  it("čísluje výskyty od nuly v pořadí ze souboru", async () => {
    const parts = {
      date: "2026-01-14",
      amount: -2400,
      currency: "CZK",
      counterAccount: "",
      vs: "",
      normalizedDescription: "x",
      ownAccount: "1",
    };
    const [a, b, c] = await fingerprintAll([parts, parts, parts]);
    expect(new Set([a, b, c]).size).toBe(3);
  });
});

describe("kontrolní součty", () => {
  it("drží převody mimo příjmy i výdaje", async () => {
    const { rows } = await parseMasterCsv(
      csv(
        row({ castka_celkem: "-500.00" }),
        row({ castka_celkem: "1000.00" }),
        row({ castka_celkem: "-7000.00", interni_prevod: "ano" }),
        row({ castka_celkem: "7000.00", interni_prevod: "ano" }),
      ),
    );

    expect(monthlyTotals(rows)).toEqual([
      {
        month: "2026-01",
        rows: 4,
        income: czk(1_000),
        expenses: czk(500),
        transfers: 2,
      },
    ]);
  });
});
