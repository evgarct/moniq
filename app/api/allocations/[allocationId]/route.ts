import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { deleteWalletAllocation, updateWalletAllocation } from "@/features/finance/server/repository";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";
import { walletAllocationInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ allocationId: string }> }) {
  return withApiPerformance(request, "wallet_allocation_update", async () => {
    try {
      const { allocationId } = await params;
      const payload = walletAllocationInputSchema.parse(await request.json());
      return NextResponse.json(
        await withMutationPerformance(request, "update_wallet_allocation", () => updateWalletAllocation(allocationId, payload)),
      );
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.wallet.update");
    }
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ allocationId: string }> }) {
  return withApiPerformance(request, "wallet_allocation_delete", async () => {
    try {
      const { allocationId } = await params;
      return NextResponse.json(
        await withMutationPerformance(request, "delete_wallet_allocation", () => deleteWalletAllocation(allocationId)),
      );
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.wallet.delete");
    }
  });
}
