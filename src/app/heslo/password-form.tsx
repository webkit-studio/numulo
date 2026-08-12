"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";
import { PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

type Stage = "ask-email" | "set-password" | "emailed";

export function PasswordForm({ token }: { token: string | null }) {
  const router = useRouter();
  // A link from the e-mail lands straight on the new-password step.
  const [stage, setStage] = useState<Stage>(token ? "set-password" : "ask-email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function requestHelp(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await postJson<{ bootstrap?: boolean; sent?: boolean }>(
      apiUrl("/api/auth/password-help"),
      { email },
    );

    if (result.data?.bootstrap) setStage("set-password");
    else if (result.ok && result.data?.sent) setStage("emailed");
    else setError(result.error);
    setPending(false);
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await postJson(apiUrl("/api/auth/set-password"), {
      email,
      password,
      token: token ?? "",
    });

    if (!result.ok) {
      setError(result.error);
      setPending(false);
      return;
    }

    // Navigation is deliberately outside the request handling: a router error
    // must not be reported as "the password could not be set" when it was.
    router.replace("/");
    router.refresh();
  }

  if (stage === "emailed") {
    return (
      <div className="login-form">
        <p>
          Pokud ten e-mail známe, poslali jsme na něj odkaz. Platí hodinu a dá
          se použít jen jednou.
        </p>
        <Link href="/login" className="login-secondary">
          Zpátky na přihlášení
        </Link>
      </div>
    );
  }

  if (stage === "set-password") {
    return (
      <form onSubmit={submitPassword} className="login-form">
        {token ? null : (
          <>
            <label htmlFor="email-confirm">E-mail</label>
            <input
              id="email-confirm"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </>
        )}

        <label htmlFor="new-password">Nové heslo</label>
        <input
          id="new-password"
          type="password"
          autoComplete="new-password"
          autoFocus
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          aria-describedby="password-hint"
        />
        <p id="password-hint" className="seed-hint">
          Aspoň {PASSWORD_MIN_LENGTH} znaků.
        </p>

        {error ? (
          <p role="alert" className="login-error">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={pending || password.length === 0}>
          {pending ? "Ukládám…" : "Nastavit heslo a přihlásit"}
        </button>
      </form>
    );
  }

  return (
    <form onSubmit={requestHelp} className="login-form">
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        type="email"
        autoComplete="username"
        autoFocus
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      {error ? (
        <p role="alert" className="login-error">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending || !email}>
        {pending ? "Odesílám…" : "Pokračovat"}
      </button>

      <Link href="/login" className="login-secondary">
        Zpátky na přihlášení
      </Link>
    </form>
  );
}
