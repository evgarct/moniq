import { NextResponse } from "next/server";
import { z } from "zod";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { adjustWalletBalance, getFinanceSnapshot } from "@/features/finance/server/repository";
import { requireMutationEntitlementForRequest } from "@/lib/billing/server";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";

const adjustSchema = z.object({
  newBalance: z.number(),
  note: z.string().nullable().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ walletId: string }> }) {
  return withApiPerformance(request, "wallet_adjust", async () => {
    try {
      await requireMutationEntitlementForRequest(request);
      const { newBalance, note } = adjustSchema.parse(await request.json());
      const { walletId } = await params;
      await withMutationPerformance(request, "adjust_wallet_balance", () => adjustWalletBalance(walletId, newBalance, note ?? null));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.wallet.update");
    }
  });
}
