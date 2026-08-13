import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { accounts } from "@/db/schema";
import { withJsonErrors } from "@/lib/http";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { parseCzkAmount } from "@/lib/money";

export const dynamic = "force-dynamic";

export const POST = withJsonErrors(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as {
    monthlyBudget?: unknown;
    initialBalance?: unknown;
    initialBalanceDate?: unknown;
  } | null;

  if (!body) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const patch: Partial<typeof accounts.$inferInsert> = {};

  if (typeof body.monthlyBudget === "string") {
    const value = parseCzkAmount(body.monthlyBudget);
    if (value === null || value < 0) {
      return NextResponse.json(
        { error: "Měsíční rozpočet musí být číslo." },
        { status: 400 },
      );
    }
    patch.monthlyBudget = value;
  }

  if (typeof body.initialBalance === "string") {
    // May legitimately be negative — an overdrawn account is still a position.
    const value = parseCzkAmount(body.initialBalance);
    if (value === null) {
      return NextResponse.json(
        { error: "Počáteční stav musí být číslo." },
        { status: 400 },
      );
    }
    patch.initialBalance = value;
  }

  if (typeof body.initialBalanceDate === "string") {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.initialBalanceDate)) {
      return NextResponse.json(
        { error: "Datum musí být ve tvaru RRRR-MM-DD." },
        { status: 400 },
      );
    }
    patch.initialBalanceDate = body.initialBalanceDate;
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nic k uložení." }, { status: 400 });
  }

  await db_update(patch);
  return NextResponse.json({ ok: true });
});

async function db_update(patch: Partial<typeof accounts.$inferInsert>) {
  await getDb().update(accounts).set(patch).where(eq(accounts.id, ACCOUNT_ID));
}
