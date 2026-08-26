import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface HouseholdRow {
  id: string;
  name: string;
  kind: "household" | "business";
  join_code: string;
  currency: string;
  monthly_budget: number;
  initial_balance: number;
  initial_balance_date: string | null;
  savings_mode: "amount" | "percent";
  savings_value: number;
}

export interface Viewer {
  id: string;
  email: string | null;
  displayName: string;
}

/**
 * The signed-in person and the household they are looking at.
 *
 * Cached per request: nearly every server component needs it, and without the
 * cache one page render would ask Supabase the same question a dozen times.
 */
export const getSession = cache(async (): Promise<{
  viewer: Viewer | null;
  household: HouseholdRow | null;
  householdCount: number;
}> => {
  const supabase = await createClient();

  // Identity comes out of the JWT, verified locally by signature — the name
  // is in user_metadata, put there at sign-up. The earlier getUser() +
  // profiles pair cost two network round-trips on every single page render,
  // to learn what the token already carries.
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims as
    | { sub: string; email?: string; user_metadata?: { display_name?: string } }
    | undefined;

  if (!claims?.sub) return { viewer: null, household: null, householdCount: 0 };

  const viewer: Viewer = {
    id: claims.sub,
    email: claims.email ?? null,
    displayName:
      claims.user_metadata?.display_name?.trim() || claims.email?.split("@")[0] || "Ty",
  };

  // RLS already limits this to households the viewer belongs to, so there is
  // no membership filter to remember — and no way to forget one.
  const { data: households } = await supabase
    .from("households")
    .select("*")
    .order("created_at", { ascending: true });

  const list = (households ?? []) as HouseholdRow[];
  return { viewer, household: list[0] ?? null, householdCount: list.length };
});

export interface Member {
  userId: string;
  role: "owner" | "member";
  name: string;
  /** First letter, for the avatar on every transaction row. */
  initial: string;
}

/**
 * Members of a household, for the "who spent it" avatars and for settings.
 *
 * Fetched as two queries rather than one embedded join: memberships.user_id
 * references auth.users, not profiles, so PostgREST has no relationship to
 * infer and the embed silently returns nothing.
 */
export async function getMembers(householdId: string): Promise<Member[]> {
  const supabase = await createClient();

  const { data: rows } = await supabase
    .from("memberships")
    .select("user_id, role")
    .eq("household_id", householdId);

  const ids = (rows ?? []).map((row) => row.user_id as string);
  if (ids.length === 0) return [];

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, display_name")
    .in("id", ids);

  const names = new Map(
    (profiles ?? []).map((row) => [row.id as string, row.display_name as string]),
  );

  return (rows ?? []).map((row) => {
    const name = names.get(row.user_id as string) ?? "Člen";
    return {
      userId: row.user_id as string,
      role: row.role as "owner" | "member",
      name,
      initial: name.slice(0, 1).toUpperCase(),
    };
  });
}

/** Top-level categories for pickers — cached per request like the session. */
export const getCategoryChips = cache(async (householdId: string) => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("categories")
    .select("id, name, color, parent_id")
    .eq("household_id", householdId)
    .order("sort");

  return (data ?? [])
    .filter((row) => !row.parent_id)
    .map((row) => ({ id: String(row.id), name: String(row.name), color: String(row.color) }));
});
