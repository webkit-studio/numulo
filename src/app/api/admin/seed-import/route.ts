import { getCloudflareContext } from "@opennextjs/cloudflare";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { runSeedImport } from "@/lib/import/seed-import";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

const ACCOUNT_ID = 1;
const MAX_BYTES = 8 * 1024 * 1024;

/** Archives the raw file before anything parses it, so a mis-parse is fixable. */
async function archive(filename: string, text: string): Promise<string | null> {
  try {
    const { env } = getCloudflareContext();
    const key = `imports/${new Date().toISOString()}-${filename}`;
    await env.IMPORTS.put(key, text);
    return key;
  } catch {
    // Object Storage missing locally is not a reason to lose the import.
    return null;
  }
}

export const POST = withJsonErrors(async (request: NextRequest) => {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "chybí soubor" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "soubor je příliš velký" }, { status: 413 });
  }

  // The master CSV is UTF-8; the bank exports get their own decoder in the
  // regular import pipeline (Air Bank is windows-1250).
  const text = await file.text();
  const storageKey = await archive(file.name, text);

  try {
    const result = await runSeedImport(
      getDb(),
      ACCOUNT_ID,
      file.name,
      text,
      storageKey,
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: (error as Error).message },
      { status: 500 },
    );
  }
});
