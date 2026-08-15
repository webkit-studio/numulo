import { NextResponse, type NextRequest } from "next/server";
import { AiUnavailableError, hasAiKey } from "@/lib/ai/client";
import { suggestCategories } from "@/lib/ai/categorise";
import { getCategories } from "@/lib/data/queries";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/** One request should stay cheap; the workbench sorts by spend anyway. */
const MAX_MERCHANTS = 60;

export const POST = withJsonErrors(async (request: NextRequest) => {
  if (!hasAiKey()) {
    return NextResponse.json(
      { error: "AI není nastavená — chybí ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as {
    merchants?: unknown;
  } | null;

  const merchants = Array.isArray(body?.merchants)
    ? body.merchants
        .filter((value): value is string => typeof value === "string")
        .map((value) => value.trim())
        .filter((value) => value !== "")
        .slice(0, MAX_MERCHANTS)
    : [];

  if (merchants.length === 0) {
    return NextResponse.json({ suggestions: [] });
  }

  try {
    const categories = await getCategories();
    const suggestions = await suggestCategories(merchants, categories);
    return NextResponse.json({ suggestions });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
});
