import { NextResponse } from "next/server";

import { createWalletAllocation, getFinanceSnapshot } from "@/features/finance/server/repository";
import { allocationInputSchema } from "@/types/finance-schemas";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const values = allocationInputSchema.parse(payload);
    const walletId = String(payload.walletId ?? "").trim();

    if (!walletId) {
      return NextResponse.json({ error: "walletId is required." }, { status: 400 });
    }

    await createWalletAllocation(walletId, values);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create allocation.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

