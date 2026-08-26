import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Přihlášení" };

/** Only same-origin in-app paths, so `?dal=` cannot become an open redirect. */
function safeNext(value: string | string[] | undefined): string {
  if (typeof value !== "string") return "/";
  if (!value.startsWith("/") || value.startsWith("//")) return "/";
  return value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;

  const notice =
    params.chyba === "odkaz"
      ? "Ten odkaz už neplatí — platí hodinu a jde použít jednou. Nech si poslat nový."
      : params.stav === "potvrd"
        ? "Hotovo. Podívej se do mailu — poslali jsme ti potvrzovací odkaz."
        : params.stav === "heslo"
          ? "Heslo je změněné. Přihlas se s novým."
          : null;

  return (
    <AuthShell
      title="Vítej zpátky"
      lede="Přihlas se e-mailem a heslem."
      notice={notice}
    >
      <LoginForm next={safeNext(params.dal)} />

      <div className="auth-links">
        <Link href="/heslo">Zapomenuté heslo</Link>
        <Link href="/registrace">Nemáš účet? Založ si ho</Link>
      </div>
    </AuthShell>
  );
}
