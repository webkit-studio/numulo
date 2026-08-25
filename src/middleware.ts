import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/** Reachable without a session. Everything else needs one. */
const PUBLIC = ["/prihlaseni", "/registrace", "/heslo", "/auth"];

export async function middleware(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );

  if (!user && !isPublic) {
    const login = request.nextUrl.clone();
    login.pathname = "/prihlaseni";
    login.search = "";
    if (pathname !== "/") login.searchParams.set("dal", pathname);
    return NextResponse.redirect(login);
  }

  // Someone already signed in has no use for the sign-in screens.
  if (user && (pathname === "/prihlaseni" || pathname === "/registrace")) {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons/|.*\\.(?:svg|png|webmanifest)$).*)"],
};
