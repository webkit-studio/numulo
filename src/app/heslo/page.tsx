import type { Metadata } from "next";
import { PasswordForm } from "./password-form";

export const metadata: Metadata = { title: "numo — heslo" };
export const dynamic = "force-dynamic";

export default async function PasswordPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : null;

  return (
    <main className="login-screen">
      <div className="login-card">
        <h1 className="login-wordmark">numo</h1>
        <p className="login-lede">
          {token
            ? "Zvol si nové heslo."
            : "Zadej svůj e-mail. Když heslo ještě nemáš, rovnou si ho nastavíš; jinak ti pošleme odkaz."}
        </p>
        <PasswordForm token={token} />
      </div>
    </main>
  );
}
