import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { createTransactionEntry, createTransactionEntryBatch, getFinanceSnapshot } from "@/features/finance/server/repository";
import { requireMutationEntitlementForRequest } from "@/lib/billing/server";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";
import { transactionEntryBatchInputSchema, transactionEntryInputSchema } from "@/types/finance-schemas";

export async function POST(request: Request) {
  return withApiPerformance(request, "transactions_create", async () => {
    try {
      await requireMutationEntitlementForRequest(request);
      const body = await request.json();
      const batchPayload = transactionEntryBatchInputSchema.safeParse(body);

      if (batchPayload.success) {
        await withMutationPerformance(request, "create_transaction_batch", () => createTransactionEntryBatch(batchPayload.data.entries), {
          entries_count: batchPayload.data.entries.length,
        });
      } else {
        const payload = transactionEntryInputSchema.parse(body);
        await withMutationPerformance(request, "create_transaction", () => createTransactionEntry(payload));
      }

      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.transaction.create");
    }
  });
}
