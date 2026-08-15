import type { Metadata, Viewport } from "next";
import "./globals.css";

const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/+$/, "");

export const metadata: Metadata = {
  title: "numo",
  description: "Rodinné finance pro domácnost",
  // Next prefixes `manifest` with the base path on its own; the icons are
  // plain public files, so those paths are built here.
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "numo", statusBarStyle: "default" },
  icons: {
    icon: [{ url: `${BASE}/icons/icon-192.png`, sizes: "192x192", type: "image/png" }],
    apple: [{ url: `${BASE}/icons/icon-192.png`, sizes: "192x192" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f6f6f4",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body>{children}</body>
    </html>
  );
}
