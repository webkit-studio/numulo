"use client";

import { useActionState } from "react";
import { signUp } from "@/app/actions/auth";
import { emptyState } from "@/app/actions/state";
import { SubmitButton } from "@/components/submit-button";

export function RegisterForm() {
  const [state, action] = useActionState(signUp, emptyState);

  if (state.notice) {
    return <p className="auth-notice" style={{ marginTop: "var(--s6)" }}>{state.notice}</p>;
  }

  return (
    <form className="auth-form" action={action}>
      <label className="field">
        <span className="field-label">Jak ti máme říkat</span>
        <input className="input" type="text" name="name" autoComplete="name" autoFocus required />
      </label>

      <label className="field">
        <span className="field-label">E-mail</span>
        <input className="input" type="email" name="email" autoComplete="email" required />
      </label>

      <label className="field">
        <span className="field-label">Heslo</span>
        <input
          className="input"
          type="password"
          name="password"
          autoComplete="new-password"
          minLength={8}
          required
        />
        <span className="field-hint">aspoň 8 znaků</span>
      </label>

      {state.error ? <p className="auth-error" role="alert">{state.error}</p> : null}

      <SubmitButton pendingLabel="Zakládám…">Založit účet</SubmitButton>
    </form>
  );
}
