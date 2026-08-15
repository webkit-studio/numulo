import { debts } from "@/db/schema";
import { crudRoutes } from "@/lib/crud/resource";

export const dynamic = "force-dynamic";

const routes = crudRoutes({
  table: debts,
  labels: {
    creditor: "věřitel",
    totalAmount: "celková částka",
    remainingAmount: "zbývá",
    installmentAmount: "splátka",
    installmentDay: "den splátky",
    targetAccount: "číslo účtu",
    vs: "variabilní symbol",
    note: "poznámka",
  },
  fields: {
    creditor: { type: "text", required: true },
    totalAmount: { type: "money", required: true, min: 0 },
    remainingAmount: { type: "money", required: true, min: 0 },
    installmentAmount: { type: "money", required: true, min: 0 },
    installmentDay: { type: "int", nullable: true, min: 1, max: 31 },
    // These two are what lets an imported payment find its debt on its own.
    targetAccount: { type: "text", nullable: true },
    vs: { type: "text", nullable: true },
    note: { type: "text", nullable: true },
    active: { type: "bool" },
  },
});

// Next discovers HTTP handlers by looking for these exact named exports,
// so they are written out rather than destructured off the factory result.
export const POST = routes.POST;
export const PATCH = routes.PATCH;
export const DELETE = routes.DELETE;
