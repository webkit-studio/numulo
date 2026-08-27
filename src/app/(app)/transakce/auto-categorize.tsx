"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { applyCategorize, getAiJob, startCategorize } from "@/app/actions/ai";
import { useToast } from "@/components/toast";

type Phase =
  | { name: "idle" }
  | { name: "running"; jobId: string }
  | { name: "applying" };

/**
 * "Roztřídit automaticky" — the merchants a rule does not know yet go to the
 * model (names only), and what comes back lands as rules. The button then has
 * less and less to do: the second press after a new import usually finds only
 * the merchants the household has never seen before.
 */
export function AutoCategorize({
  householdId,
  uncategorized,
}: {
  householdId: string;
  uncategorized: number;
}) {
  const toast = useToast();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>({ name: "idle" });

  useEffect(() => {
    if (phase.name !== "running") return;

    const timer = setInterval(async () => {
      const job = await getAiJob(phase.jobId);
      if (!job) return;

      if (job.status === "error") {
        toast.show(job.error ?? "Třídění selhalo.", "danger");
        setPhase({ name: "idle" });
      } else if (job.status === "done") {
        setPhase({ name: "applying" });
        const result = await applyCategorize(phase.jobId);
        if (result.error) {
          toast.show(result.error, "danger");
        } else {
          toast.show(
            `Roztříděno ${result.categorized} transakcí` +
              (result.newSubcategories
                ? ` · ${result.newSubcategories} nových podkategorií`
                : ""),
          );
          router.refresh();
        }
        setPhase({ name: "idle" });
      }
    }, 2500);

    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  if (uncategorized === 0) return null;

  const busy = phase.name !== "idle";

  return (
    <button
      type="button"
      className="btn"
      disabled={busy}
      onClick={async () => {
        const started = await startCategorize(householdId);
        if (started.error || !started.jobId) {
          toast.show(started.error ?? "Nepovedlo se to.", "danger");
          return;
        }
        setPhase({ name: "running", jobId: started.jobId });
      }}
    >
      {phase.name === "running"
        ? "Třídím…"
        : phase.name === "applying"
          ? "Zapisuju pravidla…"
          : `Roztřídit automaticky (${uncategorized})`}
    </button>
  );
}
