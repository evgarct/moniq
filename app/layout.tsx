import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono, PT_Serif } from "next/font/google";
import { getLocale } from "next-intl/server";
import { cookies } from "next/headers";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";

import { AppProviders } from "@/components/providers/app-providers";
import { ServiceWorkerRegistrar } from "@/components/providers/service-worker-registrar";
import { WebVitalsReporter } from "@/components/providers/web-vitals";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CANONICAL_APP_URL } from "@/lib/app-url";

import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
});

const ptSerif = PT_Serif({
  variable: "--font-pt-serif",
  weight: ["400", "700"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(CANONICAL_APP_URL),
  title: "Moniq",
  description: "A calm personal finance workspace for balances, plans, and transactions.",
  applicationName: "Moniq",
  manifest: "/manifest.webmanifest",
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Moniq",
  },
  openGraph: {
    type: "website",
    url: CANONICAL_APP_URL,
    title: "Moniq",
    description: "A calm personal finance workspace for balances, plans, and transactions.",
    siteName: "Moniq",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fafaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
  colorScheme: "light dark",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const cookieStore = await cookies();
  const theme = cookieStore.get("theme")?.value ?? "system";
  const themeClass = theme === "dark" ? "dark" : "";
  const themeDataAttr = theme === "dark" ? "dark" : theme === "light" ? "light" : undefined;

  return (
    <html
      lang={locale}
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${inter.variable} ${jetBrainsMono.variable} ${ptSerif.variable} h-full antialiased ${themeClass}`}
      data-theme={themeDataAttr}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('theme');
                if (!theme) {
                  var match = document.cookie.split('; ').find(function(row) { return row.startsWith('theme='); });
                  theme = match ? match.split('=')[1] : 'system';
                }
                var isDark = theme === 'dark' || (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
                if (isDark) {
                  document.documentElement.setAttribute('data-theme', 'dark');
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.setAttribute('data-theme', 'light');
                  document.documentElement.classList.remove('dark');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground">
        <TooltipProvider>
          <ServiceWorkerRegistrar />
          <WebVitalsReporter />
          <AppProviders>{children}</AppProviders>
        </TooltipProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
