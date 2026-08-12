import { addMonths, type IsoMonth } from "@/lib/date";
import type { CalcDebt } from "./types";

export interface DebtPayoff {
  /** Instalments still to pay. `null` when the instalment is zero or missing. */
  months: number | null;
  /** Month of the final instalment — the "čistý ~" label. */
  cleanBy: IsoMonth | null;
}

/** Per-debt estimate: remaining ÷ instalment, rounded up. */
export function estimatePayoff(
  debt: CalcDebt,
  fromMonth: IsoMonth,
): DebtPayoff {
  if (debt.installmentAmount <= 0) return { months: null, cleanBy: null };
  if (debt.remainingAmount <= 0) return { months: 0, cleanBy: null };

  const months = Math.ceil(debt.remainingAmount / debt.installmentAmount);
  // The first instalment lands in `fromMonth`, so the last one is months−1 later.
  return { months, cleanBy: addMonths(fromMonth, months - 1) };
}

export interface DebtsSummary {
  totalOwed: number;
  monthlyInstalments: number;
  /** When the longest-living debt is cleared. */
  cleanBy: IsoMonth | null;
}

export function summariseDebts(
  debts: readonly CalcDebt[],
  fromMonth: IsoMonth,
): DebtsSummary {
  const active = debts.filter((debt) => debt.active);

  const cleanBy = active.reduce<IsoMonth | null>((latest, debt) => {
    const { cleanBy: month } = estimatePayoff(debt, fromMonth);
    if (month === null) return latest;
    return latest === null || month > latest ? month : latest;
  }, null);

  return {
    totalOwed: active.reduce((sum, debt) => sum + debt.remainingAmount, 0),
    monthlyInstalments: active.reduce(
      (sum, debt) => sum + debt.installmentAmount,
      0,
    ),
    cleanBy,
  };
}
