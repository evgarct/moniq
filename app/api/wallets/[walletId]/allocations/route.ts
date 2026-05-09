import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { createWalletAllocation } from "@/features/finance/server/repository";
import { walletAllocationInputSchema } from "@/types/finance-schemas";

export async function POST(request: Request, { params }: { params: Promise<{ walletId: string }> }) {
  try {
    const { walletId } = await params;
    const payload = walletAllocationInputSchema.parse(await request.json());
    return NextResponse.json(await createWalletAllocation(walletId, payload));
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.wallet.update");
  }
}
