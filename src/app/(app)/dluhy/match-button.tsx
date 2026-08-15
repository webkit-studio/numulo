"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";

/** Books imported payments onto their debts, matched by VS or account number. */
export function MatchButton() {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      className="crud-add"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const result = await postJson<{ booked: number }>(
          apiUrl("/api/debts/match"),
          {},
        );
        setBusy(false);

        if (!result.ok) {
          toast.show(result.error ?? "Nepovedlo se to.", { tone: "danger" });
          return;
        }

        const booked = result.data?.booked ?? 0;
        toast.show(
          booked === 0
            ? "Ve výpisu není nic, co by sedělo na VS nebo číslo účtu."
            : `Zapsáno ${booked} splátek z výpisu.`,
          { tone: booked === 0 ? "info" : "success" },
        );
        router.refresh();
      }}
    >
      {busy ? "Hledám…" : "Najít splátky ve výpisu"}
    </button>
  );
}
