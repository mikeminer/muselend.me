import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "https://muselend.me"),
  title: { default: "MuseLend — Creator Token Lending", template: "%s · MuseLend" },
  description: "Unlock USDC from your creator token with capped synthetic exposure on Base.",
  applicationName: "MuseLend",
  manifest: "/site.webmanifest",
  icons: { icon: [{ url: "/favicon.ico", sizes: "any" }, { url: "/favicon.svg", type: "image/svg+xml" }], apple: "/apple-touch-icon.png" },
  openGraph: { title: "MuseLend", description: "Creator Token Lending on Base", url: "https://muselend.me", siteName: "MuseLend", type: "website" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} dark h-full`}>
      <body className="flex min-h-full flex-col antialiased">{children}</body>
    </html>
  );
}
