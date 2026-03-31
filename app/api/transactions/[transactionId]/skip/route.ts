import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { getFinanceSnapshot, skipTransactionOccurrence } from "@/features/finance/server/repository";

export async function POST(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  try {
    const { transactionId } = await params;
    await skipTransactionOccurrence(transactionId);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.transaction.update");
  }
}
