"use client";

import { useActionState, useEffect, useRef } from "react";
import { changePassword } from "@/app/actions/auth";
import { emptyState } from "@/app/actions/state";
import { SubmitButton } from "@/components/submit-button";
import { useToast } from "@/components/toast";

/**
 * Change your password without leaving the app.
 *
 * The e-mailed reset link is for someone who cannot get in at all. Making it
 * the only way to change a password would put a routine action behind a mailer
 * that sends a couple of messages an hour — and would fail exactly when
 * several people set up their accounts on the same afternoon.
 */
export function ChangePassword({ email }: { email: string | null }) {
  const toast = useToast();
  const [state, action] = useActionState(changePassword, emptyState);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.notice) {
      toast.show(state.notice);
      form.current?.reset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <form ref={form} action={action} className="stack-form">
      {email ? <p className="quiet-note" style={{ marginTop: 0 }}>Přihlášen{" "}jako {email}</p> : null}

      <div className="form-grid">
        <label className="field">
          <span className="field-label">Nové heslo</span>
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

        <label className="field">
          <span className="field-label">Ještě jednou</span>
          <input
            className="input"
            type="password"
            name="passwordAgain"
            autoComplete="new-password"
            minLength={8}
            required
          />
        </label>
      </div>

      {state.error ? <p className="form-error">{state.error}</p> : null}

      <SubmitButton className="btn btn-primary" pendingLabel="Měním…">Změnit heslo</SubmitButton>
    </form>
  );
}
