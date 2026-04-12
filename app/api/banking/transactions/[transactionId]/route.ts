import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { deleteBankingTransaction, getBankingSnapshot, updateBankingTransaction } from "@/features/banking/server/repository";

export async function PATCH(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  try {
    const { transactionId } = await params;
    const payload = (await request.json()) as {
      merchant_clean?: string;
      category_id?: string | null;
      kind?: "expense" | "income" | "transfer" | "debt_payment";
      wallet_id?: string;
      counterpart_wallet_id?: string | null;
    };
    await updateBankingTransaction(transactionId, payload);
    const snapshot = await getBankingSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.imports.update");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  try {
    const { transactionId } = await params;
    const snapshot = await deleteBankingTransaction(transactionId);
    return NextResponse.json(snapshot);
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.imports.deleteTransaction");
  }
}
