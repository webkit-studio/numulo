/**
 * The Webflow Cloud mount path, resolved at build time by next.config.ts and
 * inlined here. Empty string means the app sits at the domain root.
 *
 * Next prepends the base path to <Link> and router navigation on its own, so
 * this is only for raw `fetch` calls and hand-built URLs.
 */
export const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(
  /\/+$/,
  "",
);

/** Cookie `path` — must be at least "/", which an empty base path is not. */
export const COOKIE_PATH = BASE_PATH || "/";

/** Absolute in-app URL for a `fetch` from the browser. */
export function apiUrl(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
