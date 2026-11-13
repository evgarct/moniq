import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { createTransactionEntry, createTransactionEntryBatch, getFinanceSnapshot } from "@/features/finance/server/repository";
import { requireMutationEntitlementForRequest } from "@/lib/billing/server";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";
import { transactionEntryBatchInputSchema, transactionEntryInputSchema } from "@/types/finance-schemas";

const UUID_SHAPE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** `Idempotency-Key: <uuid>` makes a retried create land once: the key becomes the transaction id. */
function readIdempotencyKey(request: Request) {
  const key = request.headers.get("idempotency-key")?.trim();
  return key && UUID_SHAPE.test(key) ? key.toLowerCase() : undefined;
}

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
        // Recurring entries create a schedule, whose id space is separate; only a single ledger
        // entry takes the caller's key as its id.
        const idempotencyKey = payload.recurrence ? undefined : readIdempotencyKey(request);
        await withMutationPerformance(request, "create_transaction", () => createTransactionEntry(payload, idempotencyKey));
      }

      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.transaction.create");
    }
  });
}
