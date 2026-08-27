import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The handoff prototypes are design reference, not source.
  outputFileTracingExcludes: { "*": ["./design_handoff_numo/**"] },
  // Next inlines NEXT_PUBLIC_* only into browser bundles; the edge middleware
  // reads env at RUNTIME, and Vercel's edge runtime carries no values from
  // .env.production. The `env` key goes through DefinePlugin, which reaches
  // every compilation — middleware included. Values come from .env.production
  // (loaded before this file evaluates), so the committed file stays the
  // single source of truth and `?? ""` keeps the named startup error working.
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  },
  experimental: {
    // Back/forward and repeat visits reuse the client cache for 30 s instead
    // of a full server render. Server Actions revalidate on every write, so
    // a stale number never survives an edit.
    staleTimes: { dynamic: 30 },
  },
};

export default nextConfig;
