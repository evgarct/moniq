import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { deleteCategory, getFinanceSnapshot, updateCategory } from "@/features/finance/server/repository";
import { categoryInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  try {
    const payload = categoryInputSchema.parse(await request.json());
    const { categoryId } = await params;
    await updateCategory(categoryId, payload);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.category.update");
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  try {
    const payload = (await request.json().catch(() => null)) as { replacementCategoryId?: string | null } | null;
    const { categoryId } = await params;
    await deleteCategory(categoryId, payload?.replacementCategoryId ?? null);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.category.delete");
  }
}
