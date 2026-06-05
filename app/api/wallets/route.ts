import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { createWallet, getFinanceSnapshot } from "@/features/finance/server/repository";
import { requireMutationEntitlementForRequest } from "@/lib/billing/server";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";
import { walletInputSchema } from "@/types/finance-schemas";

export async function POST(request: Request) {
  return withApiPerformance(request, "wallet_create", async () => {
    try {
      await requireMutationEntitlementForRequest(request);
      const payload = walletInputSchema.parse(await request.json());
      await withMutationPerformance(request, "create_wallet", () => createWallet(payload));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.wallet.create");
    }
  });
}
