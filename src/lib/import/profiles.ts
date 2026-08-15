import { eq } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { formatProfiles } from "@/db/schema";
import { EMPTY_MAP, type ColumnMap } from "./mapping";
import { headerFingerprint } from "./sniff";
import type { Encoding } from "./decode";

/**
 * A remembered answer to "how is this bank's export laid out".
 *
 * The header row is the identity: the same bank exporting the same account
 * next month produces the same headers, so the second import asks nothing.
 */

export interface StoredProfile {
  id: number;
  name: string;
  delimiter: string;
  encoding: string;
  skipRows: number;
  columnMap: ColumnMap;
}

function parseMap(json: string | null): ColumnMap {
  if (!json) return { ...EMPTY_MAP };
  try {
    const parsed = JSON.parse(json) as Partial<ColumnMap>;
    return { ...EMPTY_MAP, ...parsed };
  } catch {
    // A corrupted profile must not block the import — fall back to guessing.
    return { ...EMPTY_MAP };
  }
}

export async function findProfile(
  headers: readonly string[],
): Promise<StoredProfile | null> {
  const fingerprint = headerFingerprint(headers);
  if (fingerprint === "") return null;

  const [row] = await getDb()
    .select()
    .from(formatProfiles)
    .where(eq(formatProfiles.headerFingerprint, fingerprint));

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    delimiter: row.delimiter,
    encoding: row.encoding,
    skipRows: row.skipRows,
    columnMap: parseMap(row.columnMapJson),
  };
}

export async function saveProfile(input: {
  name: string;
  headers: readonly string[];
  delimiter: string;
  encoding: Encoding;
  skipRows: number;
  columnMap: ColumnMap;
}): Promise<number> {
  const fingerprint = headerFingerprint(input.headers);

  const [row] = await getDb()
    .insert(formatProfiles)
    .values({
      name: input.name,
      headerFingerprint: fingerprint,
      delimiter: input.delimiter,
      encoding: input.encoding,
      skipRows: input.skipRows,
      columnMapJson: JSON.stringify(input.columnMap),
    })
    .onConflictDoUpdate({
      target: formatProfiles.name,
      set: {
        headerFingerprint: fingerprint,
        delimiter: input.delimiter,
        encoding: input.encoding,
        skipRows: input.skipRows,
        columnMapJson: JSON.stringify(input.columnMap),
      },
    })
    .returning({ id: formatProfiles.id });

  return row.id;
}

export async function listProfiles() {
  return getDb().select().from(formatProfiles).orderBy(formatProfiles.name);
}

export async function deleteProfile(id: number) {
  await getDb().delete(formatProfiles).where(eq(formatProfiles.id, id));
}
