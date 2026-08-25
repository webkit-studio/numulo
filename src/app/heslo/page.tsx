import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { ResetRequestForm } from "./reset-request-form";

export const metadata: Metadata = { title: "Numulo — zapomenuté heslo" };

export default function ForgottenPasswordPage() {
  return (
    <AuthShell
      title="Zapomenuté heslo"
      lede="Napiš e-mail a pošleme ti odkaz na nastavení nového."
    >
      <ResetRequestForm />
      <div className="auth-links">
        <Link href="/prihlaseni">Zpátky na přihlášení</Link>
      </div>
    </AuthShell>
  );
}
