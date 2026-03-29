import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { createTransaction, getFinanceSnapshot } from "@/features/finance/server/repository";
import { transactionInputSchema } from "@/types/finance-schemas";

export async function POST(request: Request) {
  try {
    const payload = transactionInputSchema.parse(await request.json());
    await createTransaction(payload);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.transaction.create");
  }
}
