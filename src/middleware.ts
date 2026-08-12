import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSessionToken } from "@/lib/auth/session";

/**
 * Reachable without a session. Paths are basePath-relative — Next strips the
 * mount path before middleware sees them.
 */
const PUBLIC_PATHS = new Set([
  "/login",
  "/heslo",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/password-help",
  "/api/auth/set-password",
]);

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (await readSessionToken(request.cookies.get(SESSION_COOKIE)?.value)) {
    return NextResponse.next();
  }

  // API calls get a 401 rather than an HTML redirect they can't follow.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // Clone nextUrl rather than building a fresh URL: NextURL carries the
  // basePath and re-adds it, so the redirect lands on /numo/login and not on
  // the Webflow site root.
  const loginUrl = request.nextUrl.clone();
  loginUrl.pathname = "/login";
  loginUrl.search = "";
  const target = pathname + request.nextUrl.search;
  if (target !== "/") loginUrl.searchParams.set("next", target);

  return NextResponse.redirect(loginUrl);
}

export const config = {
  // The negative-lookahead group needs at least one character, so the root
  // path has to be listed on its own — without it, Přehled would be public.
  matcher: [
    "/",
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)",
  ],
};
