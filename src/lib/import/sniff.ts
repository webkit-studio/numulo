/**
 * Works out how a CSV is put together before anything tries to read it.
 *
 * Bank exports differ in every dimension that matters — separator, preamble
 * lines above the header, quoting — and none of it is declared. Guessing wrong
 * turns the whole file into one column, which then looks like an empty import
 * rather than a parsing failure.
 */

export interface Shape {
  delimiter: string;
  /** Lines above the header row (account summaries, export timestamps). */
  skipRows: number;
  headers: string[];
}

const CANDIDATES = [";", ",", "\t", "|"];

export function splitLine(line: string, delimiter: string): string[] {
  const cells: string[] = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i++;
      } else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

/**
 * The header is the first line that splits into several named cells and is
 * followed by a line splitting into the same number of cells. A bank preamble
 * like "Výpis z účtu;;;;" fails the second half of that test.
 */
export function sniffShape(text: string): Shape {
  const lines = text
    .split(/\r?\n/)
    .slice(0, 30)
    .filter((line) => line.trim() !== "");

  let best: { shape: Shape; score: number } | null = null;

  for (const delimiter of CANDIDATES) {
    for (let skip = 0; skip < Math.min(lines.length - 1, 12); skip++) {
      const header = splitLine(lines[skip], delimiter);
      const next = splitLine(lines[skip + 1] ?? "", delimiter);

      const named = header.filter((cell) => cell !== "").length;
      if (named < 3 || next.length !== header.length) continue;

      // Prefer the earliest header with the most named columns: a later line
      // can split identically by accident, an earlier one rarely does.
      const score = named * 10 - skip;
      if (best === null || score > best.score) {
        best = { shape: { delimiter, skipRows: skip, headers: header }, score };
      }
    }
  }

  return best?.shape ?? { delimiter: ";", skipRows: 0, headers: [] };
}

/** Stable id for a header layout, so a known bank is recognised on sight. */
export function headerFingerprint(headers: readonly string[]): string {
  return headers
    .map((header) => header.trim().toLowerCase().replace(/\s+/g, " "))
    .join("|");
}
