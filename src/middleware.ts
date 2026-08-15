import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  readSessionToken,
  sessionEpochValid,
} from "@/lib/auth/session";

/**
 * Reachable without a session. Paths are basePath-relative — Next strips the
 * mount path before middleware sees them.
 */
const PUBLIC_PATHS = new Set([
  "/login",
  "/heslo",
  "/registrace",
  "/api/auth/register",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/password-help",
  "/api/auth/set-password",
  // Answers only until the first password exists — see the route.
  "/api/setup-check",
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  // Signature and expiry are pure crypto; the epoch needs a row. Both are
  // checked here rather than only in the pages, so a revoked cookie cannot
  // reach an API route that never bothers to look the user up.
  const session = await readSessionToken(
    request.cookies.get(SESSION_COOKIE)?.value,
  );
  if (session && (await sessionEpochValid(session))) {
    return NextResponse.next();
  }

  // API calls get a 401 rather than an HTML redirect they can't follow.
  if (pathname.startsWith("/api/")) {
    const denied = NextResponse.json({ error: "unauthorized" }, { status: 401 });
    if (session) denied.cookies.delete(SESSION_COOKIE);
    return denied;
  }

  // Clone nextUrl rather than building a fresh URL: NextURL carries the
  // basePath and re-adds it, so the redirect lands on /numo/login and not on
  // the Webflow site root.
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  const target = pathname + request.nextUrl.search;
  if (target !== "/") loginUrl.searchParams.set("next", target);

  const redirect = NextResponse.redirect(loginUrl);
  // A cookie that verified but is no longer current would otherwise keep
  // bouncing the browser back here on every navigation.
  if (session) redirect.cookies.delete(SESSION_COOKIE);
  return redirect;
}

export const config = {
  // The negative-lookahead group needs at least one character, so the root
  // path has to be listed on its own — without it, Přehled would be public.
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)",
  ],
};
