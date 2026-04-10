import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { batchConfirmBankingTransactions } from "@/features/banking/server/repository";

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { transactionIds?: string[] };
    const snapshot = await batchConfirmBankingTransactions(payload.transactionIds ?? []);
    return NextResponse.json(snapshot);
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.banking.confirm");
  }
}
