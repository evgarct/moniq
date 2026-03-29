import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { deleteWallet, getFinanceSnapshot, updateWallet } from "@/features/finance/server/repository";
import { walletInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ walletId: string }> }) {
  try {
    const payload = walletInputSchema.parse(await request.json());
    const { walletId } = await params;
    await updateWallet(walletId, payload);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.wallet.update");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ walletId: string }> }) {
  try {
    const { walletId } = await params;
    await deleteWallet(walletId);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.wallet.delete");
  }
}
