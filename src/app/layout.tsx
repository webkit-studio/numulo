import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, Instrument_Sans, Sora } from "next/font/google";
import "./globals.css";

const sora = Sora({ subsets: ["latin", "latin-ext"], weight: ["400", "600", "700", "800"], variable: "--font-sora", display: "swap" });
const instrument = Instrument_Sans({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600", "700"], variable: "--font-instrument", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin", "latin-ext"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Numulo",
  description: "Rodinné finance — můžu dnes utrácet, zvládáme měsíc, lezeme z toho ven?",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Numulo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#E2EDE4",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs" className={`${sora.variable} ${instrument.variable} ${plexMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
