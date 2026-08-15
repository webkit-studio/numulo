import { describe, expect, it } from "vitest";
import { bootstrapOpen } from "./bootstrap";

/**
 * The bootstrap branch of /api/auth/set-password takes identity from a
 * client-supplied e-mail and hands back a 30-day session. These tests pin the
 * one condition under which that is acceptable, because the addresses it
 * accepts are committed in a migration and every query in numo is scoped to a
 * single hard-coded account — so a wrong answer here is the household's entire
 * bank history.
 */

/** Enough of Drizzle's shape for `bootstrapOpen` to run against a fake count. */
function dbReturning(passworded: number) {
  return {
    select: () => ({
      from: () => ({
        where: async () => [{ value: passworded }],
      }),
    }),
  } as never;
}

describe("bootstrapOpen", () => {
  it("is open on a virgin install, where there is nothing to steal", async () => {
    expect(await bootstrapOpen(dbReturning(0))).toBe(true);
  });

  it("shuts the moment anyone has a password", async () => {
    expect(await bootstrapOpen(dbReturning(1))).toBe(false);
  });

  it("stays shut for the second person once the first has logged in", async () => {
    // The trap this closes: user 2 is seeded with an e-mail and no password, so
    // a per-account check would answer "open" indefinitely and let anyone who
    // guesses vera@svobs.cz claim the household.
    expect(await bootstrapOpen(dbReturning(1))).toBe(false);
    expect(await bootstrapOpen(dbReturning(2))).toBe(false);
  });
});
