import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, Montserrat } from "next/font/google";
import "@/styles/globals.css";
import { Providers } from "@/providers";
import { ArcMetadata } from "@/lib/ui/metadata";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
  weight: ["300", "400", "500", "600", "700"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  metadataBase: new URL(ArcMetadata.url),
  title: {
    default: `${ArcMetadata.name} — ${ArcMetadata.tagline}`,
    template: `%s · ${ArcMetadata.name}`,
  },
  description: ArcMetadata.longDescription,
  keywords: [...ArcMetadata.keywords],
  authors: [{ name: ArcMetadata.org.name, url: ArcMetadata.org.url }],
  creator: ArcMetadata.org.name,
  publisher: ArcMetadata.org.name,
  openGraph: {
    type: "website",
    locale: ArcMetadata.locale,
    siteName: ArcMetadata.name,
    title: `${ArcMetadata.name} — ${ArcMetadata.tagline}`,
    description: ArcMetadata.longDescription,
    images: [
      {
        url: ArcMetadata.ogImage,
        width: 1200,
        height: 630,
        alt: `${ArcMetadata.name} — ${ArcMetadata.tagline}`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${ArcMetadata.name} — ${ArcMetadata.tagline}`,
    description: ArcMetadata.description,
    images: [ArcMetadata.ogImage],
    creator: ArcMetadata.twitterHandle,
  },
  robots: { index: false, follow: false },
  icons: {
    icon: [
      { url: "/favicon.ico" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180" }],
    shortcut: "/favicon.ico",
  },
  manifest: "/site.webmanifest",
  applicationName: ArcMetadata.name,
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: ArcMetadata.themeColor },
  ],
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${jetbrainsMono.variable} ${montserrat.variable}`}>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
