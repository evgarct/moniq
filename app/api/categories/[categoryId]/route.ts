import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { deleteCategory, getFinanceSnapshot, updateCategory } from "@/features/finance/server/repository";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";
import { categoryInputSchema } from "@/types/finance-schemas";

export async function PATCH(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  return withApiPerformance(request, "category_update", async () => {
    try {
      const payload = categoryInputSchema.parse(await request.json());
      const { categoryId } = await params;
      await withMutationPerformance(request, "update_category", () => updateCategory(categoryId, payload));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.category.update");
    }
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  return withApiPerformance(request, "category_delete", async () => {
    try {
      const payload = (await request.json().catch(() => null)) as { replacementCategoryId?: string | null } | null;
      const { categoryId } = await params;
      await withMutationPerformance(request, "delete_category", () => deleteCategory(categoryId, payload?.replacementCategoryId ?? null));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.category.delete");
    }
  });
}
