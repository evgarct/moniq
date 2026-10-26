import { NextResponse } from "next/server";

import { runSpendingForecast } from "@/features/budget/lib/spending-forecast-run";
import { createSpendingForecastDb } from "@/features/budget/server/spending-forecast-db";
import { requestForecast } from "@/lib/forecast/client";

// The model answers in seconds; this leaves room for loading each user's history.
export const maxDuration = 60;

const DEFAULT_TIMEZONE = "Europe/Prague";

function getToday(now = new Date()) {
  // en-CA formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.FORECAST_TIMEZONE || DEFAULT_TIMEZONE,
  }).format(now);
}

function log(event: string, details: Record<string, unknown>) {
  console.error(JSON.stringify({ event, ...details }));
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    log("spending_forecast_failed", { reason: "cron_secret_missing" });
    return NextResponse.json({ error: "Spending forecast is not configured." }, { status: 500 });
  }
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    console.warn(JSON.stringify({ event: "spending_forecast_rejected", reason: "invalid_authorization" }));
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const dryRun = url.searchParams.get("dry_run") === "1";
  const requestedDate = url.searchParams.get("date");
  if (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return NextResponse.json({ error: "date must use YYYY-MM-DD." }, { status: 400 });
  }
  // A custom date is only honored for dry runs, so a stored forecast can never be dated in the past or future.
  const today = dryRun && requestedDate ? requestedDate : getToday();

  const startedAt = Date.now();
  try {
    const results = await runSpendingForecast({
      today,
      dryRun,
      db: createSpendingForecastDb(),
      requestForecast,
      log,
    });
    const failed = results.filter((result) => result.status === "failed");
    console.info(JSON.stringify({
      event: "spending_forecast_finished",
      today,
      dry_run: dryRun,
      users: results.length,
      failed: failed.length,
      rows: results.reduce((total, result) => total + result.rows.length, 0),
      duration_ms: Date.now() - startedAt,
    }));

    return NextResponse.json(
      {
        status: failed.length ? "partial" : "ok",
        today,
        dry_run: dryRun,
        duration_ms: Date.now() - startedAt,
        results: dryRun ? results : results.map(({ rows, ...rest }) => ({ ...rest, rows: rows.length })),
      },
      { status: failed.length ? 502 : 200 },
    );
  } catch (error) {
    log("spending_forecast_failed", { reason: error instanceof Error ? error.message : "unknown_error" });
    return NextResponse.json({ error: "Unable to compute spending forecasts." }, { status: 500 });
  }
}
