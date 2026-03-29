import { hasLocale } from "next-intl";
import type { NextRequest } from "next/server";

import { routing, type AppLocale } from "@/i18n/routing";

function normalizeLocaleCandidate(candidate: string | null | undefined): AppLocale | null {
  if (!candidate) {
    return null;
  }

  const normalized = candidate.toLowerCase();
  const base = normalized.split("-")[0];

  if (hasLocale(routing.locales, normalized)) {
    return normalized as AppLocale;
  }

  if (hasLocale(routing.locales, base)) {
    return base as AppLocale;
  }

  return null;
}

export function getLocaleFromPathname(pathname: string): AppLocale | null {
  const [, firstSegment] = pathname.split("/");
  return normalizeLocaleCandidate(firstSegment);
}

function getLocaleFromCookieHeader(cookieHeader: string | null): AppLocale | null {
  if (!cookieHeader) {
    return null;
  }

  const localeCookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("NEXT_LOCALE="));

  if (!localeCookie) {
    return null;
  }

  return normalizeLocaleCandidate(localeCookie.slice("NEXT_LOCALE=".length));
}

function getLocaleFromRefererHeader(referer: string | null): AppLocale | null {
  if (!referer) {
    return null;
  }

  try {
    return getLocaleFromPathname(new URL(referer).pathname);
  } catch {
    return null;
  }
}

function getLocaleFromAcceptLanguageHeader(acceptLanguage: string | null): AppLocale | null {
  if (!acceptLanguage) {
    return null;
  }

  for (const part of acceptLanguage.split(",")) {
    const [candidate] = part.trim().split(";");
    const locale = normalizeLocaleCandidate(candidate);

    if (locale) {
      return locale;
    }
  }

  return null;
}

export function detectRequestLocale(
  request:
    | Pick<Request, "headers" | "url">
    | Pick<NextRequest, "headers" | "nextUrl">,
): AppLocale {
  const pathname =
    "nextUrl" in request ? request.nextUrl.pathname : new URL(request.url).pathname;

  return (
    getLocaleFromPathname(pathname) ??
    getLocaleFromRefererHeader(request.headers.get("referer")) ??
    getLocaleFromCookieHeader(request.headers.get("cookie")) ??
    getLocaleFromAcceptLanguageHeader(request.headers.get("accept-language")) ??
    routing.defaultLocale
  );
}

export function stripLocaleFromPathname(pathname: string): string {
  const locale = getLocaleFromPathname(pathname);

  if (!locale) {
    return pathname || "/";
  }

  const stripped = pathname.slice(locale.length + 1);
  return stripped ? (stripped.startsWith("/") ? stripped : `/${stripped}`) : "/";
}
