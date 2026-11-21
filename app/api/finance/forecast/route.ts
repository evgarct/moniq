import { NextResponse } from "next/server";

import { financeSnapshotErrorResponse } from "@/app/api/_lib/error-response";
import { getLatestSpendingForecast } from "@/features/budget/server/spending-forecast-read";
import { withApiPerformance } from "@/lib/performance/api";

/** Latest Chronos month-end forecast for the signed-in user (web session or Android bearer). */
export async function GET(request: Request) {
  return withApiPerformance(request, "finance_forecast", async () => {
    try {
      return NextResponse.json(await getLatestSpendingForecast());
    } catch (error) {
      return financeSnapshotErrorResponse(request, error);
    }
  });
}
