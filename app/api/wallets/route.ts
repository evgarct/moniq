import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { createWallet, getFinanceSnapshot } from "@/features/finance/server/repository";
import { walletInputSchema } from "@/types/finance-schemas";

export async function POST(request: Request) {
  try {
    const payload = walletInputSchema.parse(await request.json());
    await createWallet(payload);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.wallet.create");
  }
}
