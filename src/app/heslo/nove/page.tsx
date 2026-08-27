import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { NewPasswordForm } from "./new-password-form";

export const metadata: Metadata = { title: "Nové heslo" };

/**
 * Reached only through the e-mailed link, which the auth callback has already
 * exchanged for a session. That session is what authorises the change.
 */
export default function NewPasswordPage() {
  return (
    <AuthShell title="Nové heslo" lede="Zvol si nové heslo a rovnou tě přihlásíme.">
      <NewPasswordForm />
    </AuthShell>
  );
}
