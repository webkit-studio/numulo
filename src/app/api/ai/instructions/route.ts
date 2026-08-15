import { NextResponse, type NextRequest } from "next/server";
import { AiUnavailableError, hasAiKey } from "@/lib/ai/client";
import { interpretInstructions } from "@/lib/ai/instructions";
import { getCategories, getUsers } from "@/lib/data/queries";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Suggests rules from free text. Nothing is stored until the household ticks it. */
export const POST = withJsonErrors(async (request: NextRequest) => {
  if (!hasAiKey()) {
    return NextResponse.json(
      { error: "AI není nastavená — chybí ANTHROPIC_API_KEY." },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text : "";

  if (text.trim() === "") return NextResponse.json({ rules: [] });

  try {
    const [categories, users] = await Promise.all([getCategories(), getUsers()]);
    const rules = await interpretInstructions(text, {
      categories: categories.map((category) => category.name),
      users: users.map((user) => user.name),
    });
    return NextResponse.json({ rules });
  } catch (error) {
    if (error instanceof AiUnavailableError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    throw error;
  }
});
