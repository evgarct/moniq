import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import withSerwistInit from "@serwist/next";

const withNextIntl = createNextIntlPlugin({
  requestConfig: "./src/i18n/request.ts",
  experimental: {
    createMessagesDeclaration: "./messages/en.json",
  },
});

const withSerwist = withSerwistInit({
  additionalPrecacheEntries: [
    {
      url: "/en/offline",
      revision: process.env.VERCEL_GIT_COMMIT_SHA ?? "development",
    },
  ],
  cacheOnNavigation: true,
  disable: process.env.NODE_ENV === "development",
  maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
  reloadOnOnline: false,
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

const nextConfig: NextConfig = {
  turbopack: {},
};

export default withSerwist(withNextIntl(nextConfig));
