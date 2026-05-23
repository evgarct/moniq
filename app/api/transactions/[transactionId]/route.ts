import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { deleteTransaction, getFinanceSnapshot, updateTransaction } from "@/features/finance/server/repository";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";
import { transactionInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  return withApiPerformance(request, "transaction_update", async () => {
    try {
      const payload = transactionInputSchema.parse(await request.json());
      const { transactionId } = await params;
      await withMutationPerformance(request, "update_transaction", () => updateTransaction(transactionId, payload));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.transaction.update");
    }
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  return withApiPerformance(request, "transaction_delete", async () => {
    try {
      const { transactionId } = await params;
      await withMutationPerformance(request, "delete_transaction", () => deleteTransaction(transactionId));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.transaction.delete");
    }
  });
}
