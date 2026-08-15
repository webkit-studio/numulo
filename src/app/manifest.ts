import type { MetadataRoute } from "next";

/**
 * PWA manifest.
 *
 * `start_url` and `scope` follow the Webflow Cloud mount path, which is
 * resolved at build time — a manifest pointing at the domain root would open
 * the site's homepage instead of numo when launched from the home screen.
 */
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "numo — rodinné finance",
    short_name: "numo",
    description:
      "Přehled o penězích domácnosti: rozpočet, obálky, pravidelné platby a dluhy.",
    lang: "cs",
    start_url: `${BASE}/`,
    scope: `${BASE}/`,
    display: "standalone",
    orientation: "portrait",
    background_color: "#f6f6f4",
    theme_color: "#f6f6f4",
    icons: [
      {
        src: `${BASE}/icons/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${BASE}/icons/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${BASE}/icons/icon-maskable.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
