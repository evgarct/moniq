import { NextResponse } from "next/server";

import { deleteWallet, getFinanceSnapshot, updateWallet } from "@/features/finance/server/repository";
import { walletInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ walletId: string }> }) {
  try {
    const payload = walletInputSchema.parse(await request.json());
    const { walletId } = await params;
    await updateWallet(walletId, payload);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update wallet.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ walletId: string }> }) {
  try {
    const { walletId } = await params;
    await deleteWallet(walletId);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete wallet.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

