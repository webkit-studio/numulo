import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The handoff prototypes are design reference, not source.
  outputFileTracingExcludes: { "*": ["./design_handoff_numo/**"] },
};

export default nextConfig;
