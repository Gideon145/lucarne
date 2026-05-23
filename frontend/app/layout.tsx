import type { Metadata } from "next";
import { Orbitron, Space_Mono } from "next/font/google";
import "./globals.css";
import CountdownBanner from "@/components/CountdownBanner";

const orbitron = Orbitron({ subsets: ["latin"], variable: "--font-orbitron", display: "swap" });
const spaceMono = Space_Mono({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: "LUCARNE — World Cup Signal Intelligence",
  description: "On-chain momentum signals for 32 nations. Real-time attestations on X Layer.",
  openGraph: {
    title: "LUCARNE",
    description: "World Cup Signal Intelligence · On-chain · X Layer",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${orbitron.variable} ${spaceMono.variable}`}>
      <body>
        <CountdownBanner />
        {children}
      </body>
    </html>
  );
}

