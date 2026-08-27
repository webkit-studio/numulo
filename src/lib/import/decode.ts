/**
 * Czech bank exports come in two encodings and never say which.
 *
 * Air Bank writes windows-1250, Revolut writes UTF-8. Getting it wrong does
 * not fail loudly — it produces mojibake like "PotravinyÂ" and
 * "SluÅ¾by", which then become merchant names, which then become
 * rules. So the file is decoded both ways and the reading with fewer broken
 * characters wins.
 */

export type Encoding = "utf-8" | "windows-1250";

export interface DecodeResult {
  text: string;
  encoding: Encoding;
  /** True when even the better reading still contains broken characters. */
  ambiguous: boolean;
}

const BOM = "﻿";

/** Characters a Czech statement should never contain. */
const BROKEN = /[�ÃÂ]/g;

function damage(text: string): number {
  return (text.match(BROKEN) ?? []).length;
}

export function decodeStatement(bytes: ArrayBuffer): DecodeResult {
  const utf8 = new TextDecoder("utf-8").decode(bytes);

  // A BOM is an explicit declaration — no need to guess against it.
  if (utf8.startsWith(BOM)) {
    return { text: utf8.slice(BOM.length), encoding: "utf-8", ambiguous: false };
  }

  const cp1250 = new TextDecoder("windows-1250").decode(bytes);
  const utf8Damage = damage(utf8);
  const cp1250Damage = damage(cp1250);

  if (utf8Damage <= cp1250Damage) {
    return { text: utf8, encoding: "utf-8", ambiguous: utf8Damage > 0 };
  }
  return {
    text: cp1250,
    encoding: "windows-1250",
    ambiguous: cp1250Damage > 0,
  };
}
