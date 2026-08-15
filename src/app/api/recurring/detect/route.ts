import { NextResponse } from "next/server";
import { getRecurringCandidates, getSubscriptions } from "@/lib/data/plan";
import { withJsonErrors } from "@/lib/http";
import { detectSubscriptions } from "@/lib/recurring/detect";

export const dynamic = "force-dynamic";

/**
 * Proposes subscriptions found in the statement.
 *
 * Anything already on the list is filtered out here rather than in the UI, so
 * the screen never offers to add a duplicate of something the household has
 * already confirmed.
 */
export const GET = withJsonErrors(async () => {
  const [rows, known] = await Promise.all([
    getRecurringCandidates(),
    getSubscriptions(),
  ]);

  const seen = new Set(known.map((item) => item.name.trim().toLowerCase()));
  const found = detectSubscriptions(rows).filter(
    (item) => !seen.has(item.name.trim().toLowerCase()),
  );

  return NextResponse.json({
    candidates: found.map((item) => ({
      name: item.name,
      amount: item.amount,
      day: item.day,
      monthCount: item.months.length,
      firstMonth: item.months[0],
      lastMonth: item.months[item.months.length - 1],
      stillRunning: item.stillRunning,
    })),
  });
});
