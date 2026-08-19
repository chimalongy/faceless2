import { DM_Mono, DM_Sans, Fraunces } from "next/font/google";
import "./globals.css";

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const dmMono = DM_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "Faceless 2.0 — YouTube Automation Studio",
  description: "A production workspace for creating, composing, and automating faceless YouTube channels with Faceless 2.0.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${dmSans.variable} ${dmMono.variable} ${fraunces.variable}`}
    >
      <body
        suppressHydrationWarning
        className="bg-paper text-ink font-sans antialiased min-h-screen selection:bg-signal/20 selection:text-signal"
      >
        {children}
      </body>
    </html>
  );
}
