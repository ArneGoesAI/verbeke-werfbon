import { Figtree, Fraunces } from "next/font/google";
import type { ReactNode } from "react";

import "./globals.css";

const fraunces = Fraunces({ subsets: ["latin"], weight: ["600", "700"], variable: "--font-fraunces" });
const figtree = Figtree({ subsets: ["latin"], weight: ["400", "500", "600", "700"], variable: "--font-figtree" });

export const metadata = { title: "Werfbon · Verbeke" };
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#FAF6F0" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="nl-BE" className={`${fraunces.variable} ${figtree.variable}`}>
      <body>{children}</body>
    </html>
  );
}
