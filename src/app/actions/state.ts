/**
 * Shared shape for form actions. Lives outside the "use server" module because
 * such a file may only export async functions — a constant there is a build
 * error, not a lint warning.
 */
export interface ActionState {
  error: string | null;
  /** Set when the outcome is a message rather than a navigation. */
  notice?: string | null;
}

export const emptyState: ActionState = { error: null };
