import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { settings } from "@/db/schema";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { withJsonErrors } from "@/lib/http";
import { czkToHalere } from "@/lib/money";

export const dynamic = "force-dynamic";

/**
 * Savings target. Stored either as a fixed amount (haléře) or a percentage of
 * what came in — `savingsMode` decides how `savingsValue` is read, so the two
 * always travel together.
 */
export const POST = withJsonErrors(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as {
    savingsMode?: unknown;
    savingsValue?: unknown;
  } | null;

  const mode = body?.savingsMode;
  if (mode !== "amount" && mode !== "percent") {
    return NextResponse.json({ error: "Neplatný režim spoření." }, { status: 400 });
  }

  const raw =
    typeof body?.savingsValue === "number"
      ? body.savingsValue
      : Number(String(body?.savingsValue ?? "").replace(",", "."));

  if (!Number.isFinite(raw) || raw < 0) {
    return NextResponse.json({ error: "Částka musí být číslo." }, { status: 400 });
  }
  if (mode === "percent" && raw > 100) {
    return NextResponse.json({ error: "Procenta můžou být nejvýš 100." }, { status: 400 });
  }

  const value = mode === "amount" ? czkToHalere(raw) : raw;

  await getDb()
    .insert(settings)
    .values({ accountId: ACCOUNT_ID, savingsMode: mode, savingsValue: value })
    .onConflictDoUpdate({
      target: settings.accountId,
      set: { savingsMode: mode, savingsValue: value },
    });

  return NextResponse.json({ ok: true });
});
