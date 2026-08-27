import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieOptions } from "./cookies";
import { supabaseKey, supabaseUrl } from "./config";

/**
 * Refreshes the auth session on every request and decides who may pass.
 *
 * getClaims() verifies the JWT's signature against the project's public keys
 * (fetched once and cached), so the check is cryptographic *and* local.
 * The earlier getUser() asked Supabase over the network on every single
 * navigation — that round-trip was most of why clicking around felt slow.
 * Row-level security still authorises every actual read and write; this
 * gate only decides who gets redirected to the login screen.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl(),
    supabaseKey(),
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value } of toSet) request.cookies.set(name, value);
          response = NextResponse.next({ request });
          for (const { name, value, options } of toSet) {
            response.cookies.set(name, value, sessionCookieOptions(options));
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const user = data?.claims ? { id: String(data.claims.sub) } : null;

  return { response, user };
}
