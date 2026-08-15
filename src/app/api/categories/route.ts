import { categories } from "@/db/schema";
import { crudRoutes } from "@/lib/crud/resource";

export const dynamic = "force-dynamic";

const routes = crudRoutes({
  table: categories,
  labels: {
    name: "název",
    color: "barva",
    monthlyLimit: "měsíční rozpočet",
    inEnvelopes: "zobrazit mezi obálkami",
  },
  fields: {
    name: { type: "text", required: true },
    color: { type: "text", required: true },
    // NULL means "no limit set" — the envelope then shows spending only.
    monthlyLimit: { type: "money", nullable: true, min: 0 },
    inEnvelopes: { type: "bool" },
    sort: { type: "int", nullable: true },
  },
});

// Next discovers HTTP handlers by looking for these exact named exports,
// so they are written out rather than destructured off the factory result.
export const POST = routes.POST;
export const PATCH = routes.PATCH;
export const DELETE = routes.DELETE;
