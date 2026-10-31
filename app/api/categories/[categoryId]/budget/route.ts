import { NextResponse } from "next/server";
import { z } from "zod";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { clearCategoryBudgetOverride, getFinanceSnapshot, saveCategoryBudget } from "@/features/finance/server/repository";
import { requireMutationEntitlementForRequest } from "@/lib/billing/server";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";
import { categoryBudgetInputSchema } from "@/types/finance-schemas";

const clearOverrideSchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/) });

export async function PUT(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  return withApiPerformance(request, "category_budget_save", async () => {
    try {
      await requireMutationEntitlementForRequest(request);
      const payload = categoryBudgetInputSchema.parse(await request.json());
      const { categoryId } = await params;
      await withMutationPerformance(request, "save_category_budget", () => saveCategoryBudget(categoryId, payload));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.category.update");
    }
  });
}

/** Removes the month override sent as `{ month: "YYYY-MM" }`; the base plan applies again. */
export async function DELETE(request: Request, { params }: { params: Promise<{ categoryId: string }> }) {
  return withApiPerformance(request, "category_budget_clear", async () => {
    try {
      await requireMutationEntitlementForRequest(request);
      const payload = clearOverrideSchema.parse(await request.json());
      const { categoryId } = await params;
      await withMutationPerformance(request, "clear_category_budget_override", () => clearCategoryBudgetOverride(categoryId, payload.month));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.category.update");
    }
  });
}
