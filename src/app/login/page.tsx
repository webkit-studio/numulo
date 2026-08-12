import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "numo — přihlášení" };

/** Only same-origin in-app paths, so `?next=` can't become an open redirect. */
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

  return (
    <main className="login-screen">
      <div className="login-card">
        <h1 className="login-wordmark">numo</h1>
        <p className="login-lede">Rodinné finance. Zadej heslo domácnosti.</p>
        <LoginForm next={safeNext(params.next)} />
      </div>
    </main>
  );
}
