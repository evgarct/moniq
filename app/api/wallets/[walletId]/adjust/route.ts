import { NextResponse } from "next/server";
import { z } from "zod";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { adjustWalletBalance, getFinanceSnapshot } from "@/features/finance/server/repository";

const adjustSchema = z.object({
  newBalance: z.number(),
  note: z.string().nullable().optional(),
});

export async function POST(request: Request, { params }: { params: Promise<{ walletId: string }> }) {
  try {
    const { newBalance, note } = adjustSchema.parse(await request.json());
    const { walletId } = await params;
    await adjustWalletBalance(walletId, newBalance, note ?? null);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.wallet.update");
  }
}
