"use client";

import Link from "next/link";
import { useActionState } from "react";
import { setNewPassword } from "@/app/actions/auth";
import { emptyState } from "@/app/actions/state";
import { SubmitButton } from "@/components/submit-button";

export function NewPasswordForm() {
  const [state, action] = useActionState(setNewPassword, emptyState);

  return (
    <>
      <form className="auth-form" action={action}>
        <label className="field">
          <span className="field-label">Nové heslo</span>
          <input
            className="input"
            type="password"
            name="password"
            autoComplete="new-password"
            autoFocus
            minLength={8}
            required
          />
          <span className="field-hint">aspoň 8 znaků</span>
        </label>

        {state.error ? <p className="auth-error" role="alert">{state.error}</p> : null}

        <SubmitButton pendingLabel="Ukládám…">Nastavit heslo</SubmitButton>
      </form>

      {state.error ? (
        <div className="auth-links">
          <Link href="/heslo">Nechat poslat nový odkaz</Link>
          <Link href="/prihlaseni">Zpátky na přihlášení</Link>
        </div>
      ) : null}
    </>
  );
}
