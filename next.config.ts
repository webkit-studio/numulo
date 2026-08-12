import type { NextConfig } from "next";

/**
 * `basePath` / `assetPrefix` must match the mount path of the Webflow Cloud
 * environment. numo is mounted at `/numo`.
 *
 * Never hard-code the mount path anywhere else — import `BASE_PATH` from
 * `src/lib/base-path.ts` instead so a future remount is a one-line change.
 */
const nextConfig: NextConfig = {
  basePath: "/numo",
  assetPrefix: "/numo",
  reactStrictMode: true,
};

export default nextConfig;

// Enables `getCloudflareContext()` while running `next dev`.
// No-op in production builds — the Worker provides the real context there.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
