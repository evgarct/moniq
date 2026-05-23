import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { getFinanceSnapshot, markTransactionPaid } from "@/features/finance/server/repository";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";

export async function POST(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  return withApiPerformance(request, "transaction_mark_paid", async () => {
    try {
      const { transactionId } = await params;
      await withMutationPerformance(request, "mark_transaction_paid", () => markTransactionPaid(transactionId));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.transaction.update");
    }
  });
}
