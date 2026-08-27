import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The handoff prototypes are design reference, not source.
  outputFileTracingExcludes: { "*": ["./design_handoff_numo/**"] },
  experimental: {
    // Back/forward and repeat visits reuse the client cache for 30 s instead
    // of a full server render. Server Actions revalidate on every write, so
    // a stale number never survives an edit.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
