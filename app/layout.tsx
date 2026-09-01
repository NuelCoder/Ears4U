import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { MOCKS_ENABLED } from "@/lib/mocks";

const chillax = localFont({
  src: "./fonts/Chillax-Variable.woff2",
  variable: "--font-chillax",
  display: "swap",
});

const generalSans = localFont({
  src: "./fonts/GeneralSans-Variable.woff2",
  variable: "--font-general-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ears for you",
  description: "A companion that listens. Check in, journal, talk, grow.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={`${chillax.variable} ${generalSans.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        {MOCKS_ENABLED ? (
          <div className="pointer-events-none fixed top-3 right-3 z-50 rounded-full border-[1.5px] border-marigold bg-card px-3 py-1 text-xs font-medium text-fir shadow-sm">
            Preview data, not the live server
          </div>
        ) : null}
      </body>
    </html>
  );
}
