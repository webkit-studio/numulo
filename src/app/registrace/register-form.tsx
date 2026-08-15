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
  // The submit button is disabled until Turnstile hands over a token. When the
  // widget never loads — blocked script, wrong site key for this hostname — the
  // page would otherwise render a complete form with a dead grey button and no
  // explanation at all.
  const [widgetBroken, setWidgetBroken] = useState<string | null>(null);

  useEffect(() => {
    const render = () => {
      if (!window.turnstile || !widget.current || widgetId.current !== null) return;
      widgetId.current = window.turnstile.render(widget.current, {
        sitekey: siteKey,
        callback: (value) => {
          setWidgetBroken(null);
          setToken(value);
        },
        "expired-callback": () => setToken(""),
        "error-callback": () => {
          setToken("");
          setWidgetBroken(
            "Ověření proti botům se nepovedlo načíst. Zkus obnovit stránku; " +
              "když to nepomůže, klíč Turnstile nejspíš nepatří k téhle adrese.",
          );
        },
      });
    };

    if (window.turnstile) {
      render();
      return;
    }

    const script = document.createElement("script");
    script.src =
      "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    script.async = true;
    script.onload = render;
    script.onerror = () =>
      setWidgetBroken(
        "Ochranu proti botům se nepodařilo stáhnout — blokuje ji nejspíš " +
          "rozšíření v prohlížeči nebo síť.",
      );
    document.head.appendChild(script);

    // A script that neither loads nor errors (a hung request) would leave the
    // form silent forever, so say something after a sensible wait.
    const timeout = setTimeout(() => {
      if (widgetId.current === null) {
        setWidgetBroken(
          "Ověření proti botům se pořád nenačetlo. Zkus obnovit stránku.",
        );
      }
    }, 10_000);
    return () => clearTimeout(timeout);
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

      {widgetBroken ? <p className="login-error">{widgetBroken}</p> : null}
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
