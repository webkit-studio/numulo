"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    const result = await postJson(apiUrl("/api/auth/login"), {
      email,
      password,
    });

    if (!result.ok) {
      // 401 is the ordinary "wrong credentials"; anything else is a real
      // fault and deserves its own message rather than being papered over.
      setError(
        result.status === 401 ? "E-mail nebo heslo nesedí." : result.error,
      );
      setPending(false);
      return;
    }

    router.replace(next);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="login-form">
      <label htmlFor="email">E-mail</label>
      <input
        id="email"
        name="email"
        type="email"
        autoComplete="username"
        autoFocus
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />

      <label htmlFor="password">Heslo</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-describedby={error ? "login-error" : undefined}
      />

      {error ? (
        <p id="login-error" role="alert" className="login-error">
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={pending || !email || !password}>
        {pending ? "Přihlašuji…" : "Přihlásit"}
      </button>

      <Link href="/heslo" className="login-secondary">
        Nastavit nebo zapomenuté heslo
      </Link>

      <Link href="/registrace" className="login-secondary">
        Nemáš účet? Založ si ho
      </Link>
    </form>
  );
}
