/**
 * ─────────────────────────────────────────────────────────────────────────────
 * One shape for every editable list.
 *
 * The spec asks for the same interaction everywhere — a quiet "+ přidat" row, a
 * pencil that turns the row into inputs, a bin, a toast. Five tables written
 * five times would have drifted apart by the third one, so instead each list
 * declares its columns here and the UI and the server actions both read this
 * registry. Adding a field to a list is one line in one place.
 *
 * The registry doubles as the security boundary for the generic actions: a
 * request names a list *key*, never a table, so no caller can reach a table
 * that is not described here. Which rows they may touch is still row-level
 * security's answer, not ours.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type FieldKind = "text" | "money" | "day" | "monthNumber" | "choice" | "month";

export interface FieldSpec {
  key: string;
  label: string;
  kind: FieldKind;
  /** Placeholder in the inline form. */
  hint?: string;
  /** choice only — the toggle's options, first is the default. */
  options?: { value: string; label: string }[];
  /** A field the row can leave empty. */
  optional?: boolean;
  /** Relative width in the inline form grid. */
  grow?: number;
}

export interface ListSpec {
  table: string;
  /** What one row is called, for the toasts: "Předplatné přidáno: Netflix". */
  noun: string;
  /** The column that names the row — used in toasts and as the row's title. */
  titleField: string;
  addLabel: string;
  fields: FieldSpec[];
  /** Columns written on insert but never shown, e.g. active flags. */
  defaults?: Record<string, unknown>;
}

const AMOUNT: FieldSpec = { key: "amount", label: "částka", kind: "money", hint: "0", grow: 1 };
const DAY: FieldSpec = { key: "day", label: "den", kind: "day", hint: "15", optional: true };

export const LISTS = {
  subscriptions: {
    table: "subscriptions",
    noun: "Předplatné",
    titleField: "name",
    addLabel: "+ přidat předplatné",
    fields: [
      { key: "name", label: "název", kind: "text", hint: "Netflix", grow: 2 },
      AMOUNT,
      DAY,
    ],
    defaults: { active: true, status: "confirmed" },
  },

  monthly: {
    table: "recurring_monthly",
    noun: "Platba",
    titleField: "name",
    addLabel: "+ přidat měsíční platbu",
    fields: [
      { key: "name", label: "název", kind: "text", hint: "Nájem", grow: 2 },
      AMOUNT,
      DAY,
    ],
    defaults: { active: true },
  },

  yearly: {
    table: "recurring_yearly",
    noun: "Roční platba",
    titleField: "name",
    addLabel: "+ přidat roční platbu",
    fields: [
      { key: "name", label: "název", kind: "text", hint: "Pojištění", grow: 2 },
      AMOUNT,
      { key: "due_month", label: "měsíc", kind: "monthNumber", hint: "6" },
    ],
    defaults: { active: true },
  },

  planned: {
    table: "planned_items",
    noun: "Položka",
    titleField: "name",
    addLabel: "+ přidat plánovanou položku",
    fields: [
      { key: "name", label: "název", kind: "text", hint: "Zubař", grow: 2 },
      AMOUNT,
      {
        key: "direction",
        label: "směr",
        kind: "choice",
        options: [
          { value: "expense", label: "výdaj" },
          { value: "income", label: "příjem" },
        ],
      },
      {
        key: "interval",
        label: "kdy",
        kind: "choice",
        options: [
          { value: "once", label: "jednorázově" },
          { value: "monthly", label: "měsíčně" },
        ],
      },
      { key: "month", label: "měsíc", kind: "month", optional: true },
    ],
    defaults: { active: true },
  },

  debts: {
    table: "debts",
    noun: "Dluh",
    titleField: "creditor",
    addLabel: "+ přidat dluh",
    fields: [
      { key: "creditor", label: "věřitel", kind: "text", hint: "ČSSZ", grow: 2 },
      { key: "total_amount", label: "celkem", kind: "money", hint: "0", grow: 1 },
      { key: "remaining_amount", label: "zbývá", kind: "money", hint: "0", grow: 1 },
      { key: "installment_amount", label: "splátka", kind: "money", hint: "0", grow: 1 },
      { key: "installment_day", label: "den", kind: "day", hint: "20", optional: true },
      { key: "target_account", label: "účet", kind: "text", optional: true, grow: 2 },
      { key: "vs", label: "VS", kind: "text", optional: true },
    ],
    defaults: { active: true },
  },
} satisfies Record<string, ListSpec>;

export type ListKey = keyof typeof LISTS;

export const isListKey = (value: string): value is ListKey =>
  Object.prototype.hasOwnProperty.call(LISTS, value);
