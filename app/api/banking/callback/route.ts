import { NextResponse } from "next/server";

import { finalizeBankConnection } from "@/features/banking/server/repository";
import { routing } from "@/i18n/routing";

function getBankingRedirectUrl(origin: string) {
  return new URL(`/${routing.defaultLocale}/banking`, origin);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const errorDescription = url.searchParams.get("error_description");

  if (error) {
    const redirectUrl = getBankingRedirectUrl(url.origin);
    redirectUrl.searchParams.set("status", "error");
    redirectUrl.searchParams.set("message", errorDescription || error);
    return NextResponse.redirect(redirectUrl);
  }

  if (!code || !state) {
    const redirectUrl = getBankingRedirectUrl(url.origin);
    redirectUrl.searchParams.set("status", "error");
    redirectUrl.searchParams.set("message", "Missing authorization code.");
    return NextResponse.redirect(redirectUrl);
  }

  try {
    await finalizeBankConnection(code, state);
    const redirectUrl = getBankingRedirectUrl(url.origin);
    redirectUrl.searchParams.set("status", "connected");
    return NextResponse.redirect(redirectUrl);
  } catch (caughtError) {
    const redirectUrl = getBankingRedirectUrl(url.origin);
    redirectUrl.searchParams.set("status", "error");
    redirectUrl.searchParams.set(
      "message",
      caughtError instanceof Error ? caughtError.message : "Unable to connect a bank.",
    );
    return NextResponse.redirect(redirectUrl);
  }
}
