"use client";

import { useActionState } from "react";
import { signIn } from "@/app/actions/auth";
import { emptyState } from "@/app/actions/state";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(signIn, emptyState);

  return (
    <form className="auth-form" action={action}>
      <input type="hidden" name="dal" value={next} />

      <label className="field">
        <span className="field-label">E-mail</span>
        <input className="input" type="email" name="email" autoComplete="email" autoFocus required />
      </label>

      <label className="field">
        <span className="field-label">Heslo</span>
        <input className="input" type="password" name="password" autoComplete="current-password" required />
      </label>

      {state.error ? <p className="auth-error" role="alert">{state.error}</p> : null}

      <SubmitButton pendingLabel="Přihlašuji…">Přihlásit</SubmitButton>
    </form>
  );
}
