/**
 * The Webflow Cloud mount path. Must stay in sync with `basePath` in
 * next.config.ts. Next prepends it to <Link> and router navigation on its own,
 * so only use this for raw `fetch` calls and hand-built URLs.
 */
export const BASE_PATH = "/numo";

/** Absolute in-app URL for a `fetch` from the browser. */
export function apiUrl(path: string): string {
  return `${BASE_PATH}${path.startsWith("/") ? path : `/${path}`}`;
}
