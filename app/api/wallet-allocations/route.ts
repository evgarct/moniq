import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { createWalletAllocation, getFinanceSnapshot } from "@/features/finance/server/repository";
import { allocationInputSchema } from "@/types/finance-schemas";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const values = allocationInputSchema.parse(payload);
    const walletId = String(payload.walletId ?? "").trim();

    if (!walletId) {
      return financeErrorResponse(request, new Error("walletId is required."), "common.errors.allocation.walletRequired");
    }

    await createWalletAllocation(walletId, values);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.allocation.create");
  }
}
