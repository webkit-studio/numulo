export interface MatchableTransaction {
  id: number;
  date: string;
  /** Negative for money leaving the account. */
  amount: number;
  merchant: string | null;
  description: string | null;
}

export interface MatchableDebt {
  id: number;
  creditor: string;
  targetAccount: string | null;
  vs: string | null;
  active: boolean;
}

export interface DebtMatch {
  transactionId: number;
  debtId: number;
  amount: number;
  date: string;
  /** Which field made the match — shown so a wrong guess can be spotted. */
  reason: "vs" | "ucet";
}

const digits = (value: string): string => value.replace(/\D/g, "");

/**
 * Matches outgoing payments to debts by variable symbol or account number.
 *
 * Only those two: the creditor's *name* is not enough, because "SPLÁTKA DLUHU"
 * appears on payments to several people and matching on it would credit the
 * wrong debt. A VS or an account number identifies exactly one.
 *
 * Comparison is on digits only — statements print account numbers with
 * slashes, dashes and spaces in whatever style the exporting bank prefers.
 */
export function matchDebtPayments(
  transactions: readonly MatchableTransaction[],
  debts: readonly MatchableDebt[],
): DebtMatch[] {
  const keyed = debts
    .filter((debt) => debt.active)
    .map((debt) => ({
      debt,
      vs: debt.vs ? digits(debt.vs) : "",
      account: debt.targetAccount ? digits(debt.targetAccount) : "",
    }))
    .filter((entry) => entry.vs !== "" || entry.account !== "");

  if (keyed.length === 0) return [];

  const matches: DebtMatch[] = [];

  for (const transaction of transactions) {
    if (transaction.amount >= 0) continue;

    const haystack = `${transaction.merchant ?? ""} ${transaction.description ?? ""}`;
    const haystackDigits = digits(haystack);

    for (const entry of keyed) {
      // VS first: it is the field a payer fills in deliberately, so when both
      // could match it is the stronger signal.
      const byVs =
        entry.vs !== "" &&
        entry.vs.length >= 4 &&
        new RegExp(`(?:VS|v\\.?s\\.?)\\s*:?\\s*0*${entry.vs}\\b`, "i").test(haystack);

      const byAccount =
        entry.account !== "" &&
        entry.account.length >= 6 &&
        haystackDigits.includes(entry.account);

      if (!byVs && !byAccount) continue;

      matches.push({
        transactionId: transaction.id,
        debtId: entry.debt.id,
        amount: -transaction.amount,
        date: transaction.date,
        reason: byVs ? "vs" : "ucet",
      });
      break;
    }
  }

  return matches;
}
