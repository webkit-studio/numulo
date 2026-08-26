import Link from "next/link";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { RegisterForm } from "./register-form";

export const metadata: Metadata = { title: "Registrace" };

export default function RegisterPage() {
  return (
    <AuthShell
      title="Založ si účet"
      lede="Nejdřív účet pro sebe. Domácnost si pak založíš, nebo se k ní připojíš kódem."
    >
      <RegisterForm />

      <div className="auth-links">
        <Link href="/prihlaseni">Už účet máš? Přihlas se</Link>
      </div>
    </AuthShell>
  );
}
