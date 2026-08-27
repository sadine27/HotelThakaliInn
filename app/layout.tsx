import type { Metadata } from "next";
import { Manrope, JetBrains_Mono, Fraunces } from "next/font/google";
import DialNav from "@/components/DialNav";
import "./globals.css";

const sans = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

const serif = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-serif",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Hotel Thakali Inn | Sinamangal, Kathmandu",
  description:
    "Quiet rooms and a hot Thakali breakfast, five minutes from Tribhuvan International Airport, Kathmandu.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <body style={{ fontFamily: "var(--font-sans), system-ui, sans-serif" }}>
        {/* The dial lives here, not per page, so every route gets the same one
            and it keeps its open state across client-side navigation. */}
        <main style={{ minHeight: "100svh" }}>{children}</main>
        <DialNav />
      </body>
    </html>
  );
}
