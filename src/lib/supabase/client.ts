"use client";

import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase in the browser.
 *
 * The publishable key is public by design and grants nothing on its own —
 * every table is behind row-level security keyed on household membership, so
 * the database decides what this client may see, not the client.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
