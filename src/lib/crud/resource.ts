import { and, eq, type SQL } from "drizzle-orm";
import type { SQLiteTable } from "drizzle-orm/sqlite-core";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "@/db/getDb";
import { ACCOUNT_ID } from "@/lib/data/queries";
import { withJsonErrors } from "@/lib/http";
import { coerceAll, FieldError, type FieldSpec } from "./fields";

/**
 * Route handlers for one editable list.
 *
 * The brief's rule is "žádný read-only seznam" — every list gets add, edit and
 * delete. Writing that four times invites four subtly different behaviours, so
 * it is written once here and each list only declares its fields.
 */

export interface ResourceSpec {
  table: SQLiteTable;
  /** Column name → validation. Keys must exist on the table. */
  fields: Record<string, FieldSpec>;
  /** Czech field names, used in error messages. */
  labels?: Record<string, string>;
  /** Runs after any write — e.g. re-applying rules or recomputing a balance. */
  afterWrite?: (id: number) => Promise<void>;
}

type Row = Record<string, unknown>;

function scope(table: SQLiteTable, extra?: SQL): SQL {
  const columns = table as unknown as Record<string, never>;
  const base = eq(columns.accountId, ACCOUNT_ID as never);
  return (extra ? and(base, extra) : base) as SQL;
}

async function readBody(request: NextRequest): Promise<Row> {
  const body = (await request.json().catch(() => null)) as Row | null;
  if (!body || typeof body !== "object") {
    throw new FieldError("Chybí data.");
  }
  return body;
}

function fail(error: unknown): NextResponse | null {
  if (error instanceof FieldError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return null;
}

export function crudRoutes(spec: ResourceSpec) {
  const labels = spec.labels ?? {};
  const columns = spec.table as unknown as Record<string, never>;

  const POST = withJsonErrors(async (request: NextRequest) => {
    try {
      const values = coerceAll(spec.fields, labels, await readBody(request));
      const [row] = await getDb()
        .insert(spec.table)
        .values({ ...values, accountId: ACCOUNT_ID } as never)
        .returning();

      const id = (row as Row).id as number;
      await spec.afterWrite?.(id);
      return NextResponse.json({ ok: true, id, row });
    } catch (error) {
      return fail(error) ?? Promise.reject(error);
    }
  });

  const PATCH = withJsonErrors(async (request: NextRequest) => {
    try {
      const body = await readBody(request);
      const id = Number(body.id);
      if (!Number.isInteger(id)) {
        return NextResponse.json({ error: "Chybí id." }, { status: 400 });
      }

      const values = coerceAll(spec.fields, labels, body, { partial: true });
      if (Object.keys(values).length === 0) {
        return NextResponse.json({ error: "Není co měnit." }, { status: 400 });
      }

      const rows = await getDb()
        .update(spec.table)
        .set(values as never)
        .where(scope(spec.table, eq(columns.id, id as never)))
        .returning();

      if (rows.length === 0) {
        return NextResponse.json({ error: "Nenalezeno." }, { status: 404 });
      }

      await spec.afterWrite?.(id);
      return NextResponse.json({ ok: true, row: rows[0] });
    } catch (error) {
      return fail(error) ?? Promise.reject(error);
    }
  });

  const DELETE = withJsonErrors(async (request: NextRequest) => {
    const id = Number(new URL(request.url).searchParams.get("id"));
    if (!Number.isInteger(id)) {
      return NextResponse.json({ error: "Chybí id." }, { status: 400 });
    }

    const rows = await getDb()
      .delete(spec.table)
      .where(scope(spec.table, eq(columns.id, id as never)))
      .returning();

    if (rows.length === 0) {
      return NextResponse.json({ error: "Nenalezeno." }, { status: 404 });
    }

    // The deleted row goes back so the UI can offer an undo that re-creates it.
    return NextResponse.json({ ok: true, row: rows[0] });
  });

  return { POST, PATCH, DELETE };
}
