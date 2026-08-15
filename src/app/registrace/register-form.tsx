"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";

declare global {
  interface Window {
    turnstile?: {
      render: (
        element: HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          "expired-callback"?: () => void;
          "error-callback"?: () => void;
        },
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

/**
 * Sign-up form with a Cloudflare Turnstile check.
 *
 * The widget script is loaded here rather than in the layout: the rest of the
 * app should not pull a third-party script on every page just so one form can
 * use it.
 */
export function RegisterForm({ siteKey }: { siteKey: string }) {
  const router = useRouter();
  const widget = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (window.turnstile && widget.current && widgetId.current === null) {
      widgetId.current = window.turnstile.render(widget.current, {
        sitekey: siteKey,
        callback: setToken,
        "expired-callback": () => setToken(""),
        "error-callback": () => setToken(""),
      });
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = () => {
      if (window.turnstile && widget.current && widgetId.current === null) {
        widgetId.current = window.turnstile.render(widget.current, {
          sitekey: siteKey,
          callback: setToken,
          "expired-callback": () => setToken(""),
          "error-callback": () => setToken(""),
        });
      }
    };
    document.head.appendChild(script);
  }, [siteKey]);

  return (
    <form
      className="login-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);

        const result = await postJson(apiUrl("/api/auth/register"), {
          name,
          email,
          password,
          turnstileToken: token,
        });

        if (!result.ok) {
          setError(result.error);
          setPending(false);
          // A used token is dead; without a reset the second attempt always
          // fails and the form looks broken.
          setToken("");
          window.turnstile?.reset(widgetId.current ?? undefined);
          return;
        }

        router.replace("/");
        router.refresh();
      }}
    >
      <label>
        <span>Jak ti máme říkat</span>
        <input
          type="text"
          autoComplete="name"
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <label>
        <span>E-mail</span>
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>

      <label>
        <span>Heslo</span>
        <input
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <small>aspoň 10 znaků</small>
      </label>

      <div ref={widget} className="turnstile" />

      {error ? <p className="login-error">{error}</p> : null}

      <button type="submit" disabled={pending || token === ""}>
        {pending ? "Zakládám…" : "Založit účet"}
      </button>

      <p className="login-alt">
        Už tu účet máš? <Link href="/login">Přihlas se</Link>
      </p>
    </form>
  );
}
