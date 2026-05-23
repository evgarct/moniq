import { NextResponse } from "next/server";

import { financeSnapshotErrorResponse } from "@/app/api/_lib/error-response";
import { getFinanceSnapshot } from "@/features/finance/server/repository";
import { withApiPerformance } from "@/lib/performance/api";

export async function GET(request: Request) {
  return withApiPerformance(request, "finance_snapshot", async () => {
    try {
      const snapshot = await getFinanceSnapshot();
      return NextResponse.json(snapshot);
    } catch (error) {
      return financeSnapshotErrorResponse(request, error);
    }
  });
}
