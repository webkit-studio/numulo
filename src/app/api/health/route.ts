import { count } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/db/getDb";
import { accounts, categories, transactions, users } from "@/db/schema";
import { hasAiKey } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Behind the auth gate on purpose — it reports on the household's own data. */
export async function GET() {
  try {
    const db = getDb();
    const [accountRows, userRows, categoryRows, transactionRows] =
      await Promise.all([
        db.select({ value: count() }).from(accounts),
        db.select({ value: count() }).from(users),
        db.select({ value: count() }).from(categories),
        db.select({ value: count() }).from(transactions),
      ]);

    return NextResponse.json({
      ok: true,
      db: "up",
      ai: hasAiKey() ? "configured" : "absent",
      counts: {
        accounts: accountRows[0]?.value ?? 0,
        users: userRows[0]?.value ?? 0,
        categories: categoryRows[0]?.value ?? 0,
        transactions: transactionRows[0]?.value ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, db: "down", error: (error as Error).message },
      { status: 503 },
    );
  }
}
