import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { adjustWalletBalance, deleteWallet, getFinanceSnapshot, updateWallet } from "@/features/finance/server/repository";
import { requireMutationEntitlementForRequest } from "@/lib/billing/server";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";
import { walletInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ walletId: string }> }) {
  return withApiPerformance(request, "wallet_update", async () => {
    try {
      await requireMutationEntitlementForRequest(request);
      const payload = walletInputSchema.parse(await request.json());
      const { walletId } = await params;

      const snapshotBefore = await getFinanceSnapshot();
      const currentWallet = snapshotBefore.accounts.find((a) => a.id === walletId);
      const oldBalance = currentWallet?.balance ?? 0;

      const isNegativeKind = currentWallet?.type === "credit_card" || currentWallet?.type === "debt";
      const normalizedNewBalance = isNegativeKind ? -Math.abs(payload.balance) : Math.abs(payload.balance);

      // Update metadata keeping old balance so RPC doesn't overwrite it directly
      await withMutationPerformance(request, "update_wallet", () => updateWallet(walletId, { ...payload, balance: oldBalance }));

      // If balance changed, create an adjustment transaction (trigger updates wallet balance)
      if (Math.abs(normalizedNewBalance - oldBalance) >= 0.001) {
        await withMutationPerformance(request, "adjust_wallet_balance", () => adjustWalletBalance(walletId, normalizedNewBalance, null));
      }

      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.wallet.update");
    }
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ walletId: string }> }) {
  return withApiPerformance(request, "wallet_delete", async () => {
    try {
      await requireMutationEntitlementForRequest(request);
      const { walletId } = await params;
      await withMutationPerformance(request, "delete_wallet", () => deleteWallet(walletId));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.wallet.delete");
    }
  });
}
