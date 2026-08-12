import { NextResponse } from "next/server";

/**
 * Wraps a route handler so a thrown error still comes back as JSON.
 *
 * Without this, an exception renders Next's HTML error page; the browser then
 * fails to parse it and the UI blames the network for a server fault. Losing
 * the real reason that way costs far more than the message is worth hiding.
 */
export function withJsonErrors<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
): (...args: Args) => Promise<Response> {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error("[numo] neošetřená chyba v route:", error);
      return NextResponse.json(
        { error: `Chyba na serveru: ${message}` },
        { status: 500 },
      );
    }
  };
}
