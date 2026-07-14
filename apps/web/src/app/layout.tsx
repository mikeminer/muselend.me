import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Providers } from "@/components/providers";

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
  description:
    "Unlock USDC from your creator token with capped synthetic exposure on Base.",
  applicationName: "MuseLend",
  manifest: "/site.webmanifest",
  other: {
    "talentapp:project_verification":
      "333ab30eb32a69ad7892cd850571bbb0d1d2bf08914b9c534586f5fe7b5a0ac2acde59a61e03ce17b98aa4f549f014056bb9b8e279a8bd14a5236bdbf3484a07",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "MuseLend",
    description: "Creator Token Lending on Base",
    url: "https://muselend.me",
    siteName: "MuseLend",
    type: "website",
    images: [
      {
        url: "/brand/muselend-og.png",
        width: 1536,
        height: 910,
        alt: "MuseLend transforms creator-token liquidity into bounded USDC credit",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MuseLend",
    description: "Creator Token Lending on Base",
    images: ["/brand/muselend-og.png"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable} dark h-full`}
    >
      <body className="flex min-h-full flex-col antialiased">
        <NextIntlClientProvider>
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
