import type { IsoMonth } from "@/lib/date";

export interface DetectionRow {
  merchant: string;
  /** Positive haléře — how much left the account. */
  amount: number;
  month: IsoMonth;
}

export interface DetectedSubscription {
  name: string;
  amount: number;
  /** Typical day of month, rounded from the observed charges. */
  day: number | null;
  months: IsoMonth[];
  /** True when the newest charge is in the most recent month seen. */
  stillRunning: boolean;
}

export interface DetectOptions {
  /** How many distinct months a charge must appear in to count. */
  minMonths?: number;
  /** Amounts drift by a crown or two — 2 % tolerance absorbs that. */
  tolerance?: number;
  /** The newest month in the data; a charge missing here reads as cancelled. */
  latestMonth?: IsoMonth;
}

/**
 * Finds subscriptions in ordinary transactions.
 *
 * Deliberately arithmetic, not AI: a subscription is a merchant that charges
 * roughly the same amount in three or more separate months. That rule is
 * checkable, repeatable and costs nothing — and unlike a model, it can never
 * invent a payment that is not in the statement.
 *
 * A merchant charging twice in one month (a shop, not a subscription) still
 * counts as one month, so groceries never surface here.
 */
export function detectSubscriptions(
  rows: readonly (DetectionRow & { day?: number })[],
  options: DetectOptions = {},
): DetectedSubscription[] {
  const minMonths = options.minMonths ?? 3;
  const tolerance = options.tolerance ?? 0.02;

  const byMerchant = new Map<string, (DetectionRow & { day?: number })[]>();
  for (const row of rows) {
    const key = row.merchant.trim().toLowerCase();
    if (key === "") continue;
    const group = byMerchant.get(key) ?? [];
    group.push(row);
    byMerchant.set(key, group);
  }

  const latest =
    options.latestMonth ??
    rows.reduce<IsoMonth | null>(
      (max, row) => (max === null || row.month > max ? row.month : max),
      null,
    );

  const found: DetectedSubscription[] = [];

  for (const group of byMerchant.values()) {
    // Cluster the charges by amount so one merchant with two different
    // plans (or a price rise) shows up as two candidates, not an average.
    const clusters: { amounts: number[]; rows: typeof group }[] = [];

    for (const row of group) {
      const cluster = clusters.find(
        (candidate) =>
          Math.abs(candidate.amounts[0] - row.amount) <=
          candidate.amounts[0] * tolerance,
      );
      if (cluster) {
        cluster.amounts.push(row.amount);
        cluster.rows.push(row);
      } else {
        clusters.push({ amounts: [row.amount], rows: [row] });
      }
    }

    for (const cluster of clusters) {
      const months = [...new Set(cluster.rows.map((row) => row.month))].sort();
      if (months.length < minMonths) continue;

      const days = cluster.rows
        .map((row) => row.day)
        .filter((day): day is number => typeof day === "number");

      found.push({
        name: cluster.rows[0].merchant.trim(),
        amount: Math.round(
          cluster.amounts.reduce((sum, value) => sum + value, 0) /
            cluster.amounts.length,
        ),
        day: days.length > 0 ? median(days) : null,
        months,
        stillRunning: latest === null || months[months.length - 1] === latest,
      });
    }
  }

  // Biggest first: an unnoticed 800 Kč charge matters more than a 49 Kč one.
  return found.sort((a, b) => b.amount - a.amount);
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : sorted[middle];
}

/** What cancelling a set of recurring items frees up. */
export function simulateCancellation(
  items: readonly { id: number; amount: number }[],
  cancelledIds: readonly number[],
): { monthly: number; yearly: number } {
  const cancelled = new Set(cancelledIds);
  const monthly = items.reduce(
    (sum, item) => (cancelled.has(item.id) ? sum + item.amount : sum),
    0,
  );
  return { monthly, yearly: monthly * 12 };
}
