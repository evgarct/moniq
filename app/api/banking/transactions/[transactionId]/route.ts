import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { getBankingSnapshot, updateBankingTransaction } from "@/features/banking/server/repository";

export async function PATCH(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  try {
    const { transactionId } = await params;
    const payload = (await request.json()) as {
      merchant_clean?: string;
      category_id?: string | null;
    };
    await updateBankingTransaction(transactionId, payload);
    const snapshot = await getBankingSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.imports.update");
  }
}
