import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

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
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            for (const { name, value, options } of toSet) {
              cookieStore.set(name, value, options);
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
