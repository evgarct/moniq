import type { Metadata } from "next";
import { Inter, JetBrains_Mono, PT_Serif } from "next/font/google";
import { getLocale } from "next-intl/server";

import { AppProviders } from "@/components/providers/app-providers";
import { TooltipProvider } from "@/components/ui/tooltip";

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
  title: "Moniq",
  description: "Personal finance management app built with Next.js and Supabase.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Moniq",
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
      className={`${inter.variable} ${jetBrainsMono.variable} ${ptSerif.variable} h-full antialiased`}
    >
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
      </head>
      <body className="min-h-full bg-background font-sans text-foreground">
        <TooltipProvider>
          <AppProviders>{children}</AppProviders>
        </TooltipProvider>
      </body>
    </html>
  );
}
