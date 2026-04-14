import createMiddleware from "next-intl/middleware";
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { stripLocaleFromPathname } from "@/i18n/locale";
import { routing } from "@/i18n/routing";

const PUBLIC_PATHS = new Set(["/login", "/signup"]);
const handleI18nRouting = createMiddleware(routing);

function isPublicPath(pathname: string) {
  return PUBLIC_PATHS.has(pathname);
}

type CookieToSet = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

export async function proxy(request: NextRequest) {
  const locale = request.nextUrl.pathname.split("/")[1];
  const localizedPathname = request.nextUrl.pathname;
  const internalPathname = stripLocaleFromPathname(localizedPathname);
  const i18nResponse = handleI18nRouting(request);

  if (!routing.locales.includes(locale as (typeof routing.locales)[number])) {
    return i18nResponse;
  }

  let cookiesToSet: CookieToSet[] = [];
  let response = i18nResponse;

  const applyCookies = (nextResponse: NextResponse) => {
    for (const { name, value, options } of cookiesToSet) {
      nextResponse.cookies.set(name, value, options);
    }

    return nextResponse;
  };

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(nextCookiesToSet) {
          cookiesToSet = nextCookiesToSet;

          for (const { name, value } of nextCookiesToSet) {
            request.cookies.set(name, value);
          }

          response = i18nResponse;
          applyCookies(response);
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAuthenticated = Boolean(user);

  if (!isAuthenticated && !isPublicPath(internalPathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}/login`;
    redirectUrl.searchParams.set("next", `${localizedPathname}${request.nextUrl.search}`);
    return applyCookies(NextResponse.redirect(redirectUrl));
  }

  if (isAuthenticated && isPublicPath(internalPathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = `/${locale}/dashboard`;
    redirectUrl.search = "";
    return applyCookies(NextResponse.redirect(redirectUrl));
  }

  return applyCookies(response);
}

export default proxy;

export const config = {
  matcher: "/((?!api|trpc|_next|_vercel|.*\\..*).*)",
};
