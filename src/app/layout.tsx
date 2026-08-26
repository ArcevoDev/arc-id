import type { Metadata, Viewport } from "next";
import "@arcevo/facet-tokens/tokens.css";
import "@/styles/globals.css";
import { Providers } from "@/providers";
import { ArcMetadata } from "@/components/metadata";

export const metadata: Metadata = {
  title: {
    default: `${ArcMetadata.name} · ${ArcMetadata.tagline}`,
    template: `%s · ${ArcMetadata.name}`,
  },
  description: ArcMetadata.description,
  keywords: [...ArcMetadata.keywords],
  authors: [{ name: ArcMetadata.org.name, url: ArcMetadata.org.url }],
  creator: ArcMetadata.org.name,
  publisher: ArcMetadata.org.name,
  icons: [{ rel: "icon", url: "/arcid-bw.png" }],
  openGraph: {
    type: "website",
    locale: ArcMetadata.locale,
    siteName: ArcMetadata.name,
    title: `${ArcMetadata.name} · ${ArcMetadata.tagline}`,
    description: ArcMetadata.longDescription,
    url: ArcMetadata.url,
    images: [{ url: ArcMetadata.ogImage }],
  },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: ArcMetadata.themeColor,
  width: "device-width",
  initialScale: 1,
  colorScheme: "dark",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-scroll-behavior="smooth" suppressHydrationWarning>
      <body className="font-sans antialiased" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
