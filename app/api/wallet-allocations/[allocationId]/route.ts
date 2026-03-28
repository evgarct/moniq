import { NextResponse } from "next/server";

import { deleteWalletAllocation, getFinanceSnapshot, updateWalletAllocation } from "@/features/finance/server/repository";
import { allocationInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ allocationId: string }> }) {
  try {
    const values = allocationInputSchema.parse(await request.json());
    const { allocationId } = await params;
    await updateWalletAllocation(allocationId, values);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update allocation.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ allocationId: string }> }) {
  try {
    const { allocationId } = await params;
    await deleteWalletAllocation(allocationId);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to delete allocation.";
    const status = message === "Unauthorized" ? 401 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}

