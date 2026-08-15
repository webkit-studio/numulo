import { NextResponse, type NextRequest } from "next/server";
import { AiUnavailableError, hasAiKey } from "@/lib/ai/client";
import { suggestColumnMap } from "@/lib/ai/map-columns";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

export const POST = withJsonErrors(async (request: NextRequest) => {
  if (!hasAiKey()) {
    return NextResponse.json(
      { error: "AI není nastavená — chybí ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    headers?: unknown;
    sample?: unknown;
  } | null;

  const headers = Array.isArray(body?.headers)
    ? body.headers.filter((value): value is string => typeof value === "string")
    : [];

  if (headers.length === 0) {
    return NextResponse.json({ error: "Chybí hlavičky." }, { status: 400 });
  }

  const sample = Array.isArray(body?.sample)
    ? (body.sample.slice(0, 3) as Record<string, string>[])
    : [];

  try {
    return NextResponse.json({ columnMap: await suggestColumnMap(headers, sample) });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
});
