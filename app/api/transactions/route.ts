import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { createTransactionEntry, createTransactionEntryBatch, getFinanceSnapshot } from "@/features/finance/server/repository";
import { transactionEntryBatchInputSchema, transactionEntryInputSchema } from "@/types/finance-schemas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const batchPayload = transactionEntryBatchInputSchema.safeParse(body);

    if (batchPayload.success) {
      await createTransactionEntryBatch(batchPayload.data.entries);
    } else {
      const payload = transactionEntryInputSchema.parse(body);
      await createTransactionEntry(payload);
    }

    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.transaction.create");
  }
}
