import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { adjustWalletBalance, deleteWallet, getFinanceSnapshot, updateWallet } from "@/features/finance/server/repository";
import { walletInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ walletId: string }> }) {
  try {
    const payload = walletInputSchema.parse(await request.json());
    const { walletId } = await params;

    const snapshotBefore = await getFinanceSnapshot();
    const currentWallet = snapshotBefore.accounts.find((a) => a.id === walletId);
    const oldBalance = currentWallet?.balance ?? 0;

    // Update metadata keeping old balance so RPC doesn't overwrite it directly
    await updateWallet(walletId, { ...payload, balance: oldBalance });

    // If balance changed, create an adjustment transaction (trigger updates wallet balance)
    if (Math.abs(payload.balance - oldBalance) >= 0.001) {
      await adjustWalletBalance(walletId, payload.balance, null);
    }

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
