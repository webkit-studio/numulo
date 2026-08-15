import { recurringYearly } from "@/db/schema";
import { crudRoutes } from "@/lib/crud/resource";

export const dynamic = "force-dynamic";

const routes = crudRoutes({
  table: recurringYearly,
  labels: { name: "název", amount: "částka", dueMonth: "měsíc splatnosti" },
  fields: {
    name: { type: "text", required: true },
    amount: { type: "money", required: true, min: 0 },
    dueMonth: { type: "int", required: true, min: 1, max: 12 },
    active: { type: "bool" },
  },
});

// Next discovers HTTP handlers by looking for these exact named exports,
// so they are written out rather than destructured off the factory result.
export const POST = routes.POST;
export const PATCH = routes.PATCH;
export const DELETE = routes.DELETE;
