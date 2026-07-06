import type { Metadata, Viewport } from "next";
import { Geist, Noto_Sans_JP } from "next/font/google";

import { AppProviders } from "@/components/app-providers";
import { cn } from "@/lib/utils";

import "./globals.css";

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist",
  display: "swap",
});

const notoSansJp = Noto_Sans_JP({
  weight: ["400", "500", "600", "700"],
  preload: false,
  display: "swap",
  variable: "--font-noto-sans-jp",
});

export const metadata: Metadata = {
  title: "mogu",
  description: "mogu web app running on Cloud Run",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={cn(geist.variable, notoSansJp.variable, "font-sans")}
    >
      <body className="antialiased">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
