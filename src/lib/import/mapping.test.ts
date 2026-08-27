import { describe, expect, it } from "vitest";
import { decodeStatement } from "./decode";
import {
  EMPTY_MAP,
  guessColumnMap,
  mapRow,
  parseStatementDate,
  validateColumnMap,
} from "./mapping";
import { headerFingerprint, sniffShape } from "./sniff";

describe("decodeStatement", () => {
  const encode = (text: string) => new TextEncoder().encode(text).buffer;

  it("strips a UTF-8 BOM instead of gluing it to the first header", () => {
    const result = decodeStatement(encode("﻿Datum;Částka"));
    expect(result.text.startsWith("Datum")).toBe(true);
    expect(result.encoding).toBe("utf-8");
  });

  it("reads windows-1250 when UTF-8 would produce broken characters", () => {
    // "Sluřby" in cp1250: ř is 0xF8, y-with-caron none — use a real word.
    const cp1250 = new Uint8Array([0x50, 0x6f, 0x74, 0x72, 0x61, 0x76, 0x69, 0x6e, 0x79, 0x20, 0xe8, 0x65, 0x73, 0x6b, 0xe9]);
    const result = decodeStatement(cp1250.buffer);
    expect(result.encoding).toBe("windows-1250");
    expect(result.text).toBe("Potraviny české");
  });

  it("keeps clean UTF-8 as UTF-8", () => {
    const result = decodeStatement(encode("Potraviny české"));
    expect(result).toMatchObject({ text: "Potraviny české", encoding: "utf-8" });
  });
});

describe("sniffShape", () => {
  it("finds a semicolon header after a bank preamble", () => {
    const csv = [
      "Výpis z účtu;;;",
      "Období: 1.7.2026 - 31.7.2026;;;",
      "Datum;Částka;Měna;Popis",
      "14.07.2026;-249,00;CZK;Netflix",
      "15.07.2026;-89,90;CZK;Lidl",
    ].join("\n");

    expect(sniffShape(csv)).toMatchObject({
      delimiter: ";",
      skipRows: 2,
      headers: ["Datum", "Částka", "Měna", "Popis"],
    });
  });

  it("handles comma-separated exports", () => {
    const csv = 'Date,Amount,Currency,Description\n2026-07-14,-249.00,CZK,"Netflix, Inc."';
    const shape = sniffShape(csv);
    expect(shape.delimiter).toBe(",");
    expect(shape.headers).toEqual(["Date", "Amount", "Currency", "Description"]);
  });

  it("gives the same fingerprint regardless of case and spacing", () => {
    expect(headerFingerprint(["Datum ", "ČÁSTKA"])).toBe(
      headerFingerprint(["datum", "částka"]),
    );
  });
});

describe("guessColumnMap", () => {
  it("maps an Air Bank style header", () => {
    const map = guessColumnMap([
      "Datum provedení",
      "Částka v měně účtu",
      "Měna účtu",
      "Název protistrany",
      "Číslo protiúčtu",
      "Variabilní symbol",
      "Poznámka",
    ]);

    expect(map).toMatchObject({
      date: "Datum provedení",
      amount: "Částka v měně účtu",
      currency: "Měna účtu",
      counterparty: "Název protistrany",
      counterAccount: "Číslo protiúčtu",
      vs: "Variabilní symbol",
    });
  });

  it("maps a Revolut style English header", () => {
    const map = guessColumnMap([
      "Type",
      "Completed Date",
      "Description",
      "Amount",
      "Currency",
    ]);

    expect(map).toMatchObject({
      date: "Completed Date",
      amount: "Amount",
      currency: "Currency",
      description: "Description",
    });
  });

  it("prefers the exact header over a longer one containing it", () => {
    const map = guessColumnMap(["Datum splatnosti příkazu", "Datum", "Částka"]);
    expect(map.date).toBe("Datum");
  });

  it("finds split debit and credit columns", () => {
    const map = guessColumnMap(["Datum", "Příjem", "Výdaj", "Popis"]);
    expect(map).toMatchObject({ credit: "Příjem", debit: "Výdaj", amount: null });
  });
});

describe("validateColumnMap", () => {
  it("insists on a date and something amount-shaped", () => {
    expect(validateColumnMap(EMPTY_MAP).map((p) => p.field)).toEqual([
      "date",
      "amount",
    ]);
  });

  it("accepts a split debit/credit pair as the amount", () => {
    expect(
      validateColumnMap({ ...EMPTY_MAP, date: "Datum", debit: "Výdaj" }),
    ).toEqual([]);
  });
});

describe("parseStatementDate", () => {
  it.each([
    ["14.07.2026", "2026-07-14"],
    ["1. 7. 2026", "2026-07-01"],
    ["2026-07-14", "2026-07-14"],
    ["2026-07-14 09:12:00", "2026-07-14"],
    ["14/07/26", "2026-07-14"],
  ])("reads %s as %s", (input, expected) => {
    expect(parseStatementDate(input)).toBe(expected);
  });

  it("reads an ambiguous date as day-first", () => {
    // 03/04 is 3 April in every Czech export; month-first would move it to March.
    expect(parseStatementDate("03/04/2026")).toBe("2026-04-03");
  });

  it("refuses nonsense rather than inventing a date", () => {
    expect(parseStatementDate("")).toBeNull();
    expect(parseStatementDate("nedostupné")).toBeNull();
    expect(parseStatementDate("31.13.2026")).toBeNull();
  });
});

describe("mapRow", () => {
  const map = {
    ...EMPTY_MAP,
    date: "Datum",
    amount: "Částka",
    currency: "Měna",
    description: "Popis",
  };

  it("parses Czech number formatting", () => {
    const row = mapRow(
      { Datum: "14.07.2026", "Částka": "-1 249,50", "Měna": "CZK", Popis: "Alza" },
      map,
      2,
    );
    expect(row).toMatchObject({ date: "2026-07-14", amount: -124950, currency: "CZK" });
  });

  it("defaults the currency to CZK when the export omits it", () => {
    const row = mapRow({ Datum: "14.07.2026", "Částka": "-100" }, map, 2);
    expect(row).toMatchObject({ currency: "CZK" });
  });

  it("takes the sign from split columns", () => {
    const split = { ...EMPTY_MAP, date: "Datum", debit: "Výdaj", credit: "Příjem" };
    expect(
      mapRow({ Datum: "14.07.2026", "Výdaj": "249,00", "Příjem": "" }, split, 2),
    ).toMatchObject({ amount: -24900 });
    expect(
      mapRow({ Datum: "14.07.2026", "Výdaj": "", "Příjem": "5 000" }, split, 2),
    ).toMatchObject({ amount: 500000 });
  });

  it("reports an unreadable row instead of dropping it", () => {
    expect(mapRow({ Datum: "—", "Částka": "-100" }, map, 7)).toMatchObject({
      line: 7,
      reason: "Nečitelné datum",
    });
    expect(mapRow({ Datum: "14.07.2026", "Částka": "" }, map, 8)).toMatchObject({
      reason: "Nečitelná částka",
    });
  });
});
