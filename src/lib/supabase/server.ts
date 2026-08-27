import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { sessionCookieOptions } from "./cookies";
import { supabaseKey, supabaseUrl } from "./config";

/**
 * Supabase in a Server Component or Server Action.
 *
 * Reads the session from cookies so the same row-level security applies
 * server-side. Writes to the cookie store are wrapped because Server
 * Components may not set cookies — the middleware refreshes the session there.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    supabaseUrl(),
    supabaseKey(),
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, sessionCookieOptions(options));
            }
          } catch {
            // Called from a Server Component. The middleware already refreshed
            // the session, so there is nothing to recover here.
          }
        },
      },
    },
  );
}
