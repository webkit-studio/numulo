"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { apiUrl } from "@/lib/base-path";

export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch(apiUrl("/api/auth/login"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
        setError("Heslo nesedí. Zkus to znovu.");
        setPending(false);
        return;
      }

      router.replace(next);
      router.refresh();
    } catch {
      setError("Přihlášení se nepovedlo. Zkontroluj připojení.");
      setPending(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="login-form">
      <label htmlFor="password">Heslo</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        autoFocus
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        aria-describedby={error ? "login-error" : undefined}
      />
      {error ? (
        <p id="login-error" role="alert" className="login-error">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={pending || password.length === 0}>
        {pending ? "Přihlašuji…" : "Přihlásit"}
      </button>
    </form>
  );
}
