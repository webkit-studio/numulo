export type CrudFieldType =
  | "text"
  | "money"
  | "int"
  | "bool"
  | "enum"
  | "month"
  | "date";

export interface CrudField {
  name: string;
  label: string;
  type: CrudFieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
  hint?: string;
  required?: boolean;
  /** Halves the field width so two sit on one line. */
  half?: boolean;
}

export interface CrudItem {
  id: number;
  /** The line that names the thing. */
  title: string;
  /** Small grey line under it — dates, counts, whatever explains the row. */
  meta?: string;
  /** Right-aligned amount in haléře. */
  amount?: number | null;
  /** Chips shown next to the title. */
  flags?: string[];
  /** Dimmed: present for context, not editable here (debt instalments). */
  muted?: boolean;
  /** Edit-form values, keyed by field name. Money already in crowns. */
  values: Record<string, string | number | boolean | null>;
}
