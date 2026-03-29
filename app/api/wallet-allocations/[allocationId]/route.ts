import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { deleteWalletAllocation, getFinanceSnapshot, updateWalletAllocation } from "@/features/finance/server/repository";
import { allocationInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ allocationId: string }> }) {
  try {
    const values = allocationInputSchema.parse(await request.json());
    const { allocationId } = await params;
    await updateWalletAllocation(allocationId, values);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.allocation.update");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ allocationId: string }> }) {
  try {
    const { allocationId } = await params;
    await deleteWalletAllocation(allocationId);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.allocation.delete");
  }
}
