import { czkToHalere } from "@/lib/money";

export type FieldType =
  | "text"
  | "int"
  | "money"
  | "bool"
  | "enum"
  | "month"
  | "date";

export interface FieldSpec {
  type: FieldType;
  required?: boolean;
  /** Allowed values for `enum`. */
  values?: readonly string[];
  min?: number;
  max?: number;
  /** Empty input becomes NULL rather than 0 / "". */
  nullable?: boolean;
}

export class FieldError extends Error {}

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

const blank = (value: unknown): boolean =>
  value === undefined ||
  value === null ||
  (typeof value === "string" && value.trim() === "");

/**
 * Turns one JSON value into what the column stores.
 *
 * Amounts arrive from the form in crowns and are stored in haléře — this is the
 * boundary where that conversion happens, so no route has to remember it.
 */
export function coerce(
  label: string,
  spec: FieldSpec,
  raw: unknown,
): string | number | boolean | null {
  if (blank(raw)) {
    if (spec.required) throw new FieldError(`Chybí: ${label}.`);
    return spec.nullable ? null : spec.type === "bool" ? false : spec.type === "text" ? "" : null;
  }

  switch (spec.type) {
    case "text": {
      const text = String(raw).trim();
      if (spec.required && text === "") throw new FieldError(`Chybí: ${label}.`);
      return text;
    }

    case "bool":
      return raw === true || raw === "true" || raw === 1 || raw === "1";

    case "enum": {
      const text = String(raw);
      if (!spec.values?.includes(text)) {
        throw new FieldError(`Neplatná hodnota u ${label}.`);
      }
      return text;
    }

    case "month": {
      const text = String(raw).trim();
      if (!MONTH.test(text)) throw new FieldError(`${label}: čekám měsíc RRRR-MM.`);
      return text;
    }

    case "date": {
      const text = String(raw).trim();
      if (!DATE.test(text)) throw new FieldError(`${label}: čekám datum RRRR-MM-DD.`);
      return text;
    }

    case "int":
    case "money": {
      const number =
        typeof raw === "number" ? raw : Number(String(raw).replace(",", "."));
      if (!Number.isFinite(number)) {
        throw new FieldError(`${label}: čekám číslo.`);
      }
      if (spec.min !== undefined && number < spec.min) {
        throw new FieldError(`${label}: nejmíň ${spec.min}.`);
      }
      if (spec.max !== undefined && number > spec.max) {
        throw new FieldError(`${label}: nejvíc ${spec.max}.`);
      }
      return spec.type === "money" ? czkToHalere(number) : Math.round(number);
    }
  }
}

/** Coerces a whole payload. `partial` keeps PATCH from clearing untouched fields. */
export function coerceAll(
  fields: Record<string, FieldSpec>,
  labels: Record<string, string>,
  body: Record<string, unknown>,
  options: { partial?: boolean } = {},
): Record<string, string | number | boolean | null> {
  const out: Record<string, string | number | boolean | null> = {};

  for (const [name, spec] of Object.entries(fields)) {
    if (options.partial && !(name in body)) continue;
    out[name] = coerce(labels[name] ?? name, spec, body[name]);
  }

  return out;
}
