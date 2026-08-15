import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { withJsonErrors } from "@/lib/http";
import { deleteRule, learnRule, listRules, type RuleKind } from "@/lib/rules/engine";

export const dynamic = "force-dynamic";

const KINDS: RuleKind[] = [
  "merchant->category",
  "pattern->owner",
  "pattern->business",
  "pattern->transfer",
];

export const GET = withJsonErrors(async () =>
  NextResponse.json({ rules: await listRules(getDb(), ACCOUNT_ID) }),
);

/** Teaches a rule and applies it in one step; reports how many rows moved. */
export const POST = withJsonErrors(async (request: NextRequest) => {
  const body = (await request.json().catch(() => null)) as {
    kind?: unknown;
    pattern?: unknown;
    target?: unknown;
  } | null;

  if (
    !body ||
    typeof body.pattern !== "string" ||
    typeof body.target !== "string" ||
    typeof body.kind !== "string" ||
    !KINDS.includes(body.kind as RuleKind)
  ) {
    return NextResponse.json({ error: "Neplatné pravidlo." }, { status: 400 });
  }

  const result = await learnRule(getDb(), ACCOUNT_ID, {
    kind: body.kind as RuleKind,
    pattern: body.pattern,
    target: body.target,
    createdFrom: "sorting",
  });

  return NextResponse.json({ ok: true, updated: result.updated });
});

export const DELETE = withJsonErrors(async (request: NextRequest) => {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Chybí id." }, { status: 400 });
  }
  await deleteRule(getDb(), ACCOUNT_ID, id);
  return NextResponse.json({ ok: true });
});
