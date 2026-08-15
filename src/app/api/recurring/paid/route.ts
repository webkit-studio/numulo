import { and, eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { recurringPayments } from "@/db/schema";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

const TYPES = ["subscription", "monthly", "yearly"] as const;
type ItemType = (typeof TYPES)[number];

/**
 * Ticks a recurring item off for one month, or unticks it.
 *
 * The row's existence *is* the "paid" state — there is no boolean to get out
 * of sync, and an untick is a delete.
 */
export const POST = withJsonErrors(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as {
    itemType?: unknown;
    itemId?: unknown;
    month?: unknown;
    paid?: unknown;
  } | null;

  const itemType = body?.itemType;
  const itemId = Number(body?.itemId);
  const month = String(body?.month ?? "");

  if (!TYPES.includes(itemType as ItemType)) {
    return NextResponse.json({ error: "Neznámý typ položky." }, { status: 400 });
  }
  if (!Number.isInteger(itemId)) {
    return NextResponse.json({ error: "Chybí id položky." }, { status: 400 });
  }
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) {
    return NextResponse.json({ error: "Chybí měsíc." }, { status: 400 });
  }

  const db = getDb();
  const where = and(
    eq(recurringPayments.accountId, ACCOUNT_ID),
    eq(recurringPayments.itemType, itemType as ItemType),
    eq(recurringPayments.itemId, itemId),
    eq(recurringPayments.month, month),
  );

  if (body?.paid === false) {
    await db.delete(recurringPayments).where(where);
    return NextResponse.json({ ok: true, paid: false });
  }

  await db
    .insert(recurringPayments)
    .values({
      accountId: ACCOUNT_ID,
      itemType: itemType as ItemType,
      itemId,
      month,
    })
    .onConflictDoNothing();

  return NextResponse.json({ ok: true, paid: true });
});
