import { subscriptions } from "@/db/schema";
import { crudRoutes } from "@/lib/crud/resource";

export const dynamic = "force-dynamic";

const routes = crudRoutes({
  table: subscriptions,
  labels: { name: "název", amount: "částka", day: "den v měsíci" },
  fields: {
    name: { type: "text", required: true },
    amount: { type: "money", required: true, min: 0 },
    day: { type: "int", nullable: true, min: 1, max: 31 },
    active: { type: "bool" },
    // Editing a detected proposal is how it gets confirmed.
    status: { type: "enum", values: ["confirmed", "detected"] },
  },
});

// Next discovers HTTP handlers by looking for these exact named exports,
// so they are written out rather than destructured off the factory result.
export const POST = routes.POST;
export const PATCH = routes.PATCH;
export const DELETE = routes.DELETE;
