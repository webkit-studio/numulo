"use client";

import { useActionState } from "react";
import { requestPasswordReset } from "@/app/actions/auth";
import { emptyState } from "@/app/actions/state";
import { SubmitButton } from "@/components/submit-button";

export function ResetRequestForm() {
  const [state, action] = useActionState(requestPasswordReset, emptyState);

  if (state.notice) {
    return <p className="auth-notice" style={{ marginTop: "var(--s6)" }}>{state.notice}</p>;
  }

  return (
    <form className="auth-form" action={action}>
      <label className="field">
        <span className="field-label">E-mail</span>
        <input className="input" type="email" name="email" autoComplete="email" autoFocus required />
      </label>

      {state.error ? <p className="auth-error" role="alert">{state.error}</p> : null}

      <SubmitButton pendingLabel="Odesílám…">Poslat odkaz</SubmitButton>
    </form>
  );
}
