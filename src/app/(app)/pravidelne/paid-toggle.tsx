"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useToast } from "@/components/toast/toast";
import { apiUrl } from "@/lib/base-path";
import { postJson } from "@/lib/client/post-json";

/**
 * "Zaplaceno" for one item in one month.
 *
 * Optimistic: the box flips straight away and only rolls back if the server
 * refuses. Ticking off eight bills should feel like ticking off a list, not
 * like waiting for eight round trips.
 */
export function PaidToggle({
  itemType,
  itemId,
  month,
  paid,
  label,
}: {
  itemType: "subscription" | "monthly" | "yearly";
  itemId: number;
  month: string;
  paid: boolean;
  label: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [checked, setChecked] = useState(paid);

  return (
    <label className="paid-toggle" title={checked ? "Zaplaceno" : "Zaplatit"}>
      <input
        type="checkbox"
        checked={checked}
        aria-label={`${label} zaplaceno`}
        onChange={async (event) => {
          const next = event.target.checked;
          setChecked(next);

          const result = await postJson(apiUrl("/api/recurring/paid"), {
            itemType,
            itemId,
            month,
            paid: next,
          });

          if (!result.ok) {
            setChecked(!next);
            toast.show(result.error ?? "Nepovedlo se to.", { tone: "danger" });
            return;
          }
          router.refresh();
        }}
      />
      <span>{checked ? "zaplaceno" : "zaplatit"}</span>
    </label>
  );
}
