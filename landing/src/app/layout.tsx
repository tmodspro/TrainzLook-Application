import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Motion } from "@/components/Motion";
import { site } from "@/site";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Only for file names and numbers the app itself prints (body.im, 512×512): they read as they do in the app.
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

const title = `${site.name}: ${site.tagline}`;

export const metadata: Metadata = {
  // shortcut: without site.url the OG image URL is relative, which social cards ignore; set it once hosting is chosen.
  metadataBase: site.url ? new URL(site.url) : undefined,
  title,
  description: site.description,
  applicationName: site.name,
  authors: [{ name: site.publisher }],
  publisher: site.publisher,
  manifest: "/manifest.webmanifest",
  openGraph: { type: "website", locale: "id_ID", siteName: site.name, title, description: site.description },
  twitter: { card: "summary_large_image", title, description: site.description },
};

export const viewport: Viewport = {
  themeColor: "#1E1F22",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${inter.variable} ${jetbrains.variable} antialiased`}>
      <body className="min-h-dvh font-sans">
        <div aria-hidden className="ambient" />
        <Motion>{children}</Motion>
      </body>
    </html>
  );
}
