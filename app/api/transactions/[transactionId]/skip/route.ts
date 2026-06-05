import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { getFinanceSnapshot, skipTransactionOccurrence } from "@/features/finance/server/repository";
import { requireMutationEntitlementForRequest } from "@/lib/billing/server";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";

export async function POST(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  return withApiPerformance(request, "transaction_skip", async () => {
    try {
      await requireMutationEntitlementForRequest(request);
      const { transactionId } = await params;
      await withMutationPerformance(request, "skip_transaction_occurrence", () => skipTransactionOccurrence(transactionId));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.transaction.update");
    }
  });
}
