import Link from "next/link";
import type { Metadata } from "next";
import { getEnvVar, hasTurnstile } from "@/lib/env";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "numo — registrace" };
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  const siteKey = getEnvVar("NEXT_PUBLIC_TURNSTILE_SITE_KEY");

  return (
    <main className="login-screen">
      <div className="login-card">
        <h1 className="login-wordmark">numo</h1>
        <p className="login-lede">Založ si účet.</p>

        {hasTurnstile() && siteKey ? (
          <RegisterForm siteKey={siteKey} />
        ) : (
          <>
            {/* Saying it plainly beats a form that fails on submit. */}
            <p className="login-error">
              Registrace je zavřená — chybí nastavení ochrany proti botům
              (TURNSTILE_SECRET_KEY a NEXT_PUBLIC_TURNSTILE_SITE_KEY).
            </p>
            <p className="login-alt">
              <Link href="/login">Zpět na přihlášení</Link>
            </p>
          </>
        )}
      </div>
    </main>
  );
}
