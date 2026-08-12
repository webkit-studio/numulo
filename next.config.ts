import type { NextConfig } from "next";

/**
 * The mount path of the Webflow Cloud environment. It is chosen when the
 * environment is created and shows up in the build log as COSMIC_MOUNT_PATH —
 * hard-coding it here means a remount silently 404s the whole app.
 *
 * Resolution order:
 *   1. NEXT_PUBLIC_BASE_PATH — set this explicitly if the automatic value is wrong
 *   2. BASE_URL — provided by Webflow Cloud
 *   3. "" — the environment is mounted at the domain root
 */
function resolveBasePath(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_PATH ?? process.env.BASE_URL ?? "";
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (trimmed === "" || trimmed === "/") return "";
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

const basePath = resolveBasePath();

const nextConfig: NextConfig = {
  basePath,
  assetPrefix: basePath,
  reactStrictMode: true,
  // Inlined into the client bundle so `apiUrl()` builds correct fetch URLs.
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
};

export default nextConfig;

// Enables `getCloudflareContext()` while running `next dev`.
// No-op in production builds — the Worker provides the real context there.
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
