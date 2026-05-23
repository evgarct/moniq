import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { createCategory, getFinanceSnapshot } from "@/features/finance/server/repository";
import { withApiPerformance, withMutationPerformance } from "@/lib/performance/api";
import { categoryInputSchema } from "@/types/finance-schemas";

export async function POST(request: Request) {
  return withApiPerformance(request, "category_create", async () => {
    try {
      const payload = categoryInputSchema.parse(await request.json());
      await withMutationPerformance(request, "create_category", () => createCategory(payload));
      return NextResponse.json(await getFinanceSnapshot());
    } catch (error) {
      return financeErrorResponse(request, error, "common.errors.category.create");
    }
  });
}
