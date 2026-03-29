import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { deleteTransaction, getFinanceSnapshot, updateTransaction } from "@/features/finance/server/repository";
import { transactionInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  try {
    const payload = transactionInputSchema.parse(await request.json());
    const { transactionId } = await params;
    await updateTransaction(transactionId, payload);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.transaction.update");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  try {
    const { transactionId } = await params;
    await deleteTransaction(transactionId);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.transaction.delete");
  }
}
