"use client";

import { useActionState, useState } from "react";
import { createHousehold, joinHousehold } from "@/app/actions/auth";
import { emptyState } from "@/app/actions/state";
import { SubmitButton } from "@/components/submit-button";

type Mode = "create" | "join";

/**
 * Two doors on one screen: start a household, or join one with a code.
 *
 * Creating is offered first because it is what the first person to arrive
 * needs — joining requires a code they would not have yet.
 */
export function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [mode, setMode] = useState<Mode>("create");
  const [createState, createAction] = useActionState(createHousehold, emptyState);
  const [joinState, joinAction] = useActionState(joinHousehold, emptyState);

  const state = mode === "create" ? createState : joinState;

  return (
    <>
      <div className="onboard-switch" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "create"}
          className={`chip${mode === "create" ? " is-on" : ""}`}
          onClick={() => setMode("create")}
        >
          Založit domácnost
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "join"}
          className={`chip${mode === "join" ? " is-on" : ""}`}
          onClick={() => setMode("join")}
        >
          Připojit se kódem
        </button>
      </div>

      {mode === "create" ? (
        <form className="auth-form" action={createAction}>
          <label className="field">
            <span className="field-label">Jak se bude jmenovat</span>
            <input className="input" type="text" name="name" defaultValue={defaultName} required />
            <span className="field-hint">
              Dostaneš rovnou jedenáct kategorií, ať je co třídit. Všechny se dají změnit.
            </span>
          </label>

          {state.error ? <p className="auth-error" role="alert">{state.error}</p> : null}
          <SubmitButton pendingLabel="Zakládám…">Založit a začít</SubmitButton>
        </form>
      ) : (
        <form className="auth-form" action={joinAction}>
          <label className="field">
            <span className="field-label">Kód domácnosti</span>
            <input
              className="input num"
              type="text"
              name="code"
              placeholder="ABCD-2345"
              autoCapitalize="characters"
              required
            />
            <span className="field-hint">
              Najde ho ten, kdo domácnost vede — v Nastavení účtu.
            </span>
          </label>

          {state.error ? <p className="auth-error" role="alert">{state.error}</p> : null}
          <SubmitButton pendingLabel="Připojuji…">Připojit se</SubmitButton>
        </form>
      )}
    </>
  );
}
