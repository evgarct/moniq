import { NextResponse } from "next/server";

import { bankingSnapshotErrorResponse } from "@/app/api/_lib/error-response";
import { getBankingSnapshot } from "@/features/banking/server/repository";
import { withApiPerformance } from "@/lib/performance/api";

export async function GET(request: Request) {
  return withApiPerformance(request, "banking_snapshot", async () => {
    try {
      const snapshot = await getBankingSnapshot();
      return NextResponse.json(snapshot);
    } catch (error) {
      return bankingSnapshotErrorResponse(request, error);
    }
  });
}
