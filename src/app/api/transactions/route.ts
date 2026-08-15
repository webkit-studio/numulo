import { and, eq, inArray } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { transactions } from "@/db/schema";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { withJsonErrors } from "@/lib/http";
import { czkToHalere } from "@/lib/money";
import { learnRule } from "@/lib/rules/engine";

export const dynamic = "force-dynamic";

interface PatchBody {
  ids?: unknown;
  categoryId?: unknown;
  ownerId?: unknown;
  isBusiness?: unknown;
  isTransfer?: unknown;
  /** When true, teach a rule from the merchant so the change sticks for good. */
  learn?: unknown;
}

/**
 * Edits one or more transactions and, on request, learns a rule from the edit.
 *
 * The rule is what makes re-categorising worth doing once instead of 122
 * times, so the response reports how many other rows it moved — that number
 * is the toast.
 */
export const PATCH = withJsonErrors(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as PatchBody | null;
  if (!body) return NextResponse.json({ error: "invalid_body" }, { status: 400 });

  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is number => Number.isInteger(id))
    : [];
  if (ids.length === 0) {
    return NextResponse.json({ error: "Chybí transakce." }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (body.categoryId === null) patch.categoryId = null;
  else if (Number.isInteger(body.categoryId)) patch.categoryId = body.categoryId;
  if (body.ownerId === null) patch.ownerId = null;
  else if (Number.isInteger(body.ownerId)) patch.ownerId = body.ownerId;
  if (typeof body.isBusiness === "boolean") patch.isBusiness = body.isBusiness;
  if (typeof body.isTransfer === "boolean") patch.isTransfer = body.isTransfer;

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nic ke změně." }, { status: 400 });
  }

  const db = getDb();
  const changed = await db
    .update(transactions)
    .set(patch)
    .where(and(eq(transactions.accountId, ACCOUNT_ID), inArray(transactions.id, ids)))
    .returning({ id: transactions.id, merchant: transactions.merchant });

  let learned = 0;
  let learnedFrom: string | null = null;

  if (body.learn === true && changed.length > 0) {
    // One rule per distinct merchant in the selection.
    const merchants = [
      ...new Set(changed.map((row) => row.merchant).filter(Boolean)),
    ] as string[];

    for (const merchant of merchants) {
      if (Number.isInteger(patch.categoryId)) {
        const result = await learnRule(
          db,
          ACCOUNT_ID,
          {
            kind: "merchant->category",
            pattern: merchant,
            target: String(patch.categoryId),
            createdFrom: `transaction:${changed[0].id}`,
          },
        );
        learned += result.updated;
      }
      if (typeof patch.isBusiness === "boolean") {
        const result = await learnRule(db, ACCOUNT_ID, {
          kind: "pattern->business",
          pattern: merchant,
          target: patch.isBusiness ? "1" : "0",
          createdFrom: `transaction:${changed[0].id}`,
        });
        learned += result.updated;
      }
      if (typeof patch.isTransfer === "boolean") {
        const result = await learnRule(db, ACCOUNT_ID, {
          kind: "pattern->transfer",
          pattern: merchant,
          target: patch.isTransfer ? "1" : "0",
          createdFrom: `transaction:${changed[0].id}`,
        });
        learned += result.updated;
      }
      learnedFrom = merchant;
    }
  }

  return NextResponse.json({
    ok: true,
    changed: changed.length,
    learned,
    learnedFrom,
  });
});

/**
 * Records a transaction typed in by hand — the cash payments no statement will
 * ever bring in.
 *
 * The fingerprint of a manual row is deliberately unique per entry rather than
 * derived from its contents: two coffees, same price, same day, are two
 * payments, and a content hash would swallow the second one exactly the way
 * the import's occurrence index exists to prevent.
 */
export const POST = withJsonErrors(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as {
    amount?: unknown;
    merchant?: unknown;
    date?: unknown;
    categoryId?: unknown;
    ownerId?: unknown;
    direction?: unknown;
    note?: unknown;
  } | null;

  const raw =
    typeof body?.amount === "number"
      ? body.amount
      : Number(String(body?.amount ?? "").replace(",", "."));

  if (!Number.isFinite(raw) || raw <= 0) {
    return NextResponse.json(
      { error: "Částka musí být kladné číslo." },
      { status: 400 },
    );
  }

  const merchant = String(body?.merchant ?? "").trim();
  if (merchant === "") {
    return NextResponse.json({ error: "Napiš, za co to bylo." }, { status: 400 });
  }

  const date = String(body?.date ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json({ error: "Datum musí být RRRR-MM-DD." }, { status: 400 });
  }

  const income = body?.direction === "income";
  const amount = czkToHalere(income ? raw : -raw);

  const [row] = await getDb()
    .insert(transactions)
    .values({
      accountId: ACCOUNT_ID,
      fingerprint: `manual:${crypto.randomUUID()}`,
      date,
      amount,
      currency: "CZK",
      merchant,
      description:
        typeof body?.note === "string" && body.note.trim() !== ""
          ? body.note.trim()
          : merchant,
      categoryId: Number.isInteger(body?.categoryId) ? (body?.categoryId as number) : null,
      ownerId: Number.isInteger(body?.ownerId) ? (body?.ownerId as number) : null,
      source: "manual",
      status: "confirmed",
    })
    .returning();

  return NextResponse.json({ ok: true, id: row.id });
});
