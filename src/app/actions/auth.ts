"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { czechAuthError } from "@/lib/auth-messages";
import type { ActionState } from "./state";

/**
 * ─────────────────────────────────────────────────────────────────────────────
 * Auth on the server.
 *
 * Every one of these could have been a client-side Supabase call, and the
 * first version was. Doing it here instead means the browser never talks to
 * Supabase directly: the session cookie is set server-side, credentials never
 * enter client JavaScript, and the app keeps working on a network that can
 * reach Numulo but not supabase.co.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Only same-origin in-app paths, so `dal` cannot become an open redirect. */
function safeNext(value: FormDataEntryValue | null): string {
  const next = typeof value === "string" ? value : "/";
  if (!next.startsWith("/") || next.startsWith("//")) return "/";
  return next;
}

async function origin(): Promise<string> {
  const list = await headers();
  const host = list.get("x-forwarded-host") ?? list.get("host") ?? "localhost:3000";
  const protocol = list.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}`;
}

export async function signIn(_prev: ActionState, form: FormData): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  const next = safeNext(form.get("dal"));

  if (!email || !password) return { error: "Vyplň e-mail i heslo." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { error: czechAuthError(error.message) };

  redirect(next);
}

export async function signUp(_prev: ActionState, form: FormData): Promise<ActionState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  if (!name) return { error: "Napiš, jak ti máme říkat." };
  if (password.length < 8) return { error: "Heslo musí mít aspoň 8 znaků." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Read by the handle_new_user trigger, so a profile exists from the
      // first moment rather than being backfilled later.
      data: { display_name: name },
      emailRedirectTo: `${await origin()}/auth/callback?next=/zalozit`,
    },
  });

  if (error) return { error: czechAuthError(error.message) };

  // With confirmation on there is no session yet. Saying so beats redirecting
  // somewhere that will only bounce them back to the login screen.
  if (!data.session) {
    return {
      error: null,
      notice:
        "Hotovo. Poslali jsme ti na e-mail potvrzovací odkaz — klikni na něj a jsi uvnitř.",
    };
  }

  redirect("/zalozit");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/prihlaseni");
}

export async function requestPasswordReset(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const email = String(form.get("email") ?? "").trim();
  if (!email) return { error: "Napiš e-mail." };

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${await origin()}/auth/callback?next=/heslo/nove`,
  });

  // Reported as sent either way. Confirming which addresses exist would turn
  // this form into a directory of who has an account here.
  if (error && !error.message.toLowerCase().includes("not found")) {
    return { error: czechAuthError(error.message) };
  }

  return {
    error: null,
    notice:
      "Pokud u nás ten e-mail známe, je na cestě odkaz na nastavení hesla. Platí hodinu a jde použít jednou.",
  };
}

export async function setNewPassword(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const password = String(form.get("password") ?? "");
  if (password.length < 8) return { error: "Heslo musí mít aspoň 8 znaků." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // The e-mailed link is what authorises this; without a session it expired.
  if (!user) {
    return { error: "Odkaz už neplatí — platí hodinu a jde použít jednou." };
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: czechAuthError(error.message) };

  redirect("/");
}

/* ── onboarding ───────────────────────────────────────────────────────── */

export async function createHousehold(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const name = String(form.get("name") ?? "").trim();
  if (!name) return { error: "Účet musí mít název." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("create_household", { p_name: name });

  if (error) return { error: error.message };

  redirect("/");
}

export async function joinHousehold(
  _prev: ActionState,
  form: FormData,
): Promise<ActionState> {
  const code = String(form.get("code") ?? "").trim();
  if (!code) return { error: "Napiš kód." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_household", { p_code: code });

  // The RPC returns a result rather than raising, so a wrong code is counted
  // against the rate limit instead of being rolled back with the exception.
  const result = data as { ok: boolean; error: string | null } | null;
  if (error) return { error: error.message };
  if (!result?.ok) return { error: result?.error ?? "Nepovedlo se to." };

  redirect("/");
}
