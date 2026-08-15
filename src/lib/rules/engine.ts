import { and, eq, isNull, like, or, sql } from "drizzle-orm";
import type { Db } from "@/db/getDb";
import { rules, transactions } from "@/db/schema";

export type RuleKind =
  | "merchant->category"
  | "pattern->owner"
  | "pattern->business"
  | "pattern->transfer";

/**
 * Rules are how numo learns. Re-categorising one transaction teaches it the
 * merchant, and every other transaction from that merchant follows.
 *
 * Matching is a case-insensitive substring on the merchant (and, for the
 * pattern rules, the description too). Deliberately not regex: these get
 * written by clicking a chip, and a stray character in a merchant name must
 * not become a broken pattern.
 */

export interface ApplyResult {
  /** How many rows the rule actually changed — the number the toast reports. */
  updated: number;
}

function likeTerm(pattern: string): string {
  // Escape LIKE wildcards so a merchant containing % or _ stays literal.
  return `%${pattern.toLowerCase().replace(/[%_]/g, "\\$&")}%`;
}

const matchesMerchant = (pattern: string) =>
  sql`lower(coalesce(${transactions.merchant}, '')) like ${likeTerm(pattern)} escape '\\'`;

const matchesAnywhere = (pattern: string) =>
  sql`(lower(coalesce(${transactions.merchant}, '')) like ${likeTerm(pattern)} escape '\\'
    or lower(coalesce(${transactions.description}, '')) like ${likeTerm(pattern)} escape '\\')`;

/**
 * Applies one rule.
 *
 * `onlyUnset` is the default because rules must never silently overwrite a
 * decision someone made by hand — a later import applies rules to new rows,
 * not to rows the household already sorted.
 */
export async function applyRule(
  db: Db,
  accountId: number,
  rule: { kind: RuleKind; pattern: string; target: string },
  options: { onlyUnset?: boolean } = {},
): Promise<ApplyResult> {
  const onlyUnset = options.onlyUnset ?? true;
  const scope = eq(transactions.accountId, accountId);

  if (rule.kind === "merchant->category") {
    const categoryId = Number(rule.target);
    if (!Number.isInteger(categoryId)) return { updated: 0 };

    const rows = await db
      .update(transactions)
      .set({ categoryId })
      .where(
        and(
          scope,
          matchesMerchant(rule.pattern),
          onlyUnset ? isNull(transactions.categoryId) : undefined,
        ),
      )
      .returning({ id: transactions.id });
    return { updated: rows.length };
  }

  if (rule.kind === "pattern->owner") {
    const ownerId = Number(rule.target);
    if (!Number.isInteger(ownerId)) return { updated: 0 };

    const rows = await db
      .update(transactions)
      .set({ ownerId })
      .where(
        and(
          scope,
          matchesAnywhere(rule.pattern),
          onlyUnset ? isNull(transactions.ownerId) : undefined,
        ),
      )
      .returning({ id: transactions.id });
    return { updated: rows.length };
  }

  const flag = rule.kind === "pattern->business" ? "isBusiness" : "isTransfer";
  const value = rule.target !== "0" && rule.target !== "false";
  const column =
    flag === "isBusiness" ? transactions.isBusiness : transactions.isTransfer;

  const rows = await db
    .update(transactions)
    .set({ [flag]: value })
    .where(and(scope, matchesAnywhere(rule.pattern), eq(column, !value)))
    .returning({ id: transactions.id });
  return { updated: rows.length };
}

/** Stores a rule (idempotently) and applies it in one go. */
export async function learnRule(
  db: Db,
  accountId: number,
  rule: { kind: RuleKind; pattern: string; target: string; createdFrom?: string },
  options: { onlyUnset?: boolean } = {},
): Promise<ApplyResult> {
  const pattern = rule.pattern.trim();
  if (pattern === "") return { updated: 0 };

  await db
    .insert(rules)
    .values({
      accountId,
      kind: rule.kind,
      pattern,
      target: rule.target,
      createdFrom: rule.createdFrom ?? "manual",
    })
    .onConflictDoUpdate({
      target: [rules.accountId, rules.kind, rules.pattern],
      set: { target: rule.target },
    });

  return applyRule(db, accountId, { ...rule, pattern }, options);
}

/** Replays every stored rule — used after an import brings in new rows. */
export async function applyAllRules(
  db: Db,
  accountId: number,
): Promise<ApplyResult> {
  const stored = await db
    .select({
      kind: rules.kind,
      pattern: rules.pattern,
      target: rules.target,
    })
    .from(rules)
    .where(eq(rules.accountId, accountId));

  let updated = 0;
  for (const rule of stored) {
    const result = await applyRule(db, accountId, rule as never);
    updated += result.updated;
  }
  return { updated };
}

export async function listRules(db: Db, accountId: number) {
  return db
    .select()
    .from(rules)
    .where(eq(rules.accountId, accountId))
    .orderBy(rules.kind, rules.pattern);
}

export async function deleteRule(db: Db, accountId: number, id: number) {
  await db
    .delete(rules)
    .where(and(eq(rules.accountId, accountId), eq(rules.id, id)));
}
