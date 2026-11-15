import type { Metadata, Viewport } from "next";
import { Geist_Pixel, Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const sans = Inter({ subsets: ["latin"], variable: "--f-sans", display: "swap" });
const pixel = Geist_Pixel({ subsets: ["latin"], weight: "variable", axes: ["ELSH"], variable: "--f-pixel", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--f-mono", display: "swap" });

export const metadata: Metadata = {
  title: "Na Income? · Your 2026 Nigerian tax from your bank statement",
  description:
    "Paste a bank statement. SERV Reasoning sorts every inflow into client payment, gift, loan, refund or own transfer under the Nigeria Tax Act 2025, and code works out your 2026 personal income tax.",
  openGraph: {
    title: "Na Income?",
    description: "Is that transfer income, a gift or a loan? Your 2026 Nigerian tax from your bank statement, read by SERV Reasoning.",
    url: "https://na-income.vercel.app",
    siteName: "Na Income?",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${sans.variable} ${pixel.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
