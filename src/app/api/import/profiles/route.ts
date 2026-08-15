import { NextResponse, type NextRequest } from "next/server";
import { deleteProfile, listProfiles } from "@/lib/import/profiles";
import { withJsonErrors } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = withJsonErrors(async () =>
  NextResponse.json({ profiles: await listProfiles() }),
);

export const DELETE = withJsonErrors(async (request: NextRequest) => {
  const id = Number(new URL(request.url).searchParams.get("id"));
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Chybí id." }, { status: 400 });
  }
  await deleteProfile(id);
  return NextResponse.json({ ok: true });
});
