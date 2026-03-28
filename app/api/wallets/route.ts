import { NextResponse } from "next/server";

import { createWallet, getFinanceSnapshot } from "@/features/finance/server/repository";
import { walletInputSchema } from "@/types/finance-schemas";

export async function POST(request: Request) {
  try {
    const payload = walletInputSchema.parse(await request.json());
    await createWallet(payload);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to create wallet.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

