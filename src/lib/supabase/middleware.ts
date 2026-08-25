import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { sessionCookieOptions } from "./cookies";
import { supabaseKey, supabaseUrl } from "./config";

/**
 * Refreshes the auth session on every request and decides who may pass.
 *
 * getUser() is used rather than getSession(): it verifies the token against
 * Supabase instead of trusting whatever the cookie claims, which is the
 * difference between a gate and a suggestion.
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

  const {
    data: { user },
  } = await supabase.auth.getUser();

  return { response, user };
}
