import { cookies } from "next/headers";
import { getDb } from "@/db/getDb";
import { SESSION_COOKIE, readSessionToken } from "./session";
import { findUserById, type AuthUser } from "./users";

/**
 * The signed-in user for a server component. Middleware has already rejected
 * unauthenticated requests, so null here means the row vanished under a live
 * session rather than "not logged in".
 */
export async function getCurrentUser(): Promise<AuthUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSessionToken(token);
  if (!session) return null;

  return findUserById(getDb(), session.userId);
}
