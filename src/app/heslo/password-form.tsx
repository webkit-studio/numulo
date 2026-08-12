"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/base-path";
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

    try {
      const response = await fetch(apiUrl("/api/auth/password-help"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const body = (await response.json()) as {
        bootstrap?: boolean;
        sent?: boolean;
        error?: string;
      };

      if (body.bootstrap) setStage("set-password");
      else if (response.ok && body.sent) setStage("emailed");
      else setError(body.error ?? "Nepovedlo se to. Zkus to znovu.");
    } catch {
      setError("Nepovedlo se to. Zkontroluj připojení.");
    } finally {
      setPending(false);
    }
  }

  async function submitPassword(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(apiUrl("/api/auth/set-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, token: token ?? "" }),
      });
      const body = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(body.error ?? "Heslo se nepodařilo nastavit.");
        setPending(false);
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Nepovedlo se to. Zkontroluj připojení.");
      setPending(false);
    }
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
