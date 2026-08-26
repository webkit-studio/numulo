import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthShell } from "@/components/auth-shell";
import { getSession } from "@/lib/data/household";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Začínáme" };
export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { viewer, household } = await getSession();

  if (!viewer) redirect("/prihlaseni");
  // Already in a household — nothing to set up.
  if (household) redirect("/");

  return (
    <AuthShell
      title={`Ahoj ${viewer.displayName}`}
      lede="Ještě jeden krok. Numulo počítá finance jedné domácnosti — založ ji, nebo se připoj k té, kterou už někdo vede."
    >
      <OnboardingForm defaultName="Domácnost" />
    </AuthShell>
  );
}
