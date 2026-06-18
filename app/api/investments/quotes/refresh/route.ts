import { NextResponse } from "next/server";

import { refreshInvestmentQuotes } from "@/features/investments/server/repository";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error(JSON.stringify({
      event: "investment_quote_refresh_failed",
      reason: "cron_secret_missing",
    }));
    return NextResponse.json({ error: "Quote refresh is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    console.warn(JSON.stringify({
      event: "investment_quote_refresh_rejected",
      reason: "invalid_authorization",
    }));
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshInvestmentQuotes();
    if (result.missing_symbols.length) {
      console.error(JSON.stringify({
        event: "investment_quote_refresh_partial",
        requested_symbols: result.requested_symbols,
        saved_symbols: result.saved_symbols,
        missing_symbols: result.missing_symbols,
      }));
      return NextResponse.json({ status: "partial", ...result }, { status: 502 });
    }

    console.info(JSON.stringify({
      event: "investment_quote_refresh_succeeded",
      requested_symbols: result.requested_symbols,
      saved_symbols: result.saved_symbols,
    }));
    return NextResponse.json({ status: "ok", ...result });
  } catch (error) {
    console.error(JSON.stringify({
      event: "investment_quote_refresh_failed",
      reason: error instanceof Error ? error.message : "unknown_error",
    }));
    return NextResponse.json({ error: "Unable to refresh investment quotes." }, { status: 500 });
  }
}
