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
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return { viewer: null, household: null, householdCount: 0 };

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

  const viewer: Viewer = {
    id: user.id,
    email: user.email ?? null,
    displayName: profile?.display_name ?? user.email?.split("@")[0] ?? "Ty",
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

/** Members of a household, for the "who spent it" avatars and settings. */
export async function getMembers(householdId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("memberships")
    .select("user_id, role, profiles(display_name)")
    .eq("household_id", householdId);

  return (data ?? []).map((row) => {
    const profile = row.profiles as unknown as { display_name: string } | null;
    return {
      userId: row.user_id as string,
      role: row.role as "owner" | "member",
      name: profile?.display_name ?? "Člen",
    };
  });
}
