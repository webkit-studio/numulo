import { desc, eq, sql } from "drizzle-orm";
import { getDb } from "@/db/getDb";
import { importBatches, transactions } from "@/db/schema";
import { ACCOUNT_ID } from "./queries";

/** Past imports with how many rows each one actually added. */
export async function getImportHistory(limit = 12) {
  return getDb()
    .select({
      id: importBatches.id,
      filename: importBatches.filename,
      storageKey: importBatches.storageKey,
      instructionsText: importBatches.instructionsText,
      importedAt: importBatches.importedAt,
      rowCount: sql<number>`(
        select count(*) from ${transactions}
        where ${transactions.importBatchId} = ${importBatches.id}
      )`,
    })
    .from(importBatches)
    .where(eq(importBatches.accountId, ACCOUNT_ID))
    .orderBy(desc(importBatches.importedAt))
    .limit(limit);
}
