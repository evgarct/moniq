import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { createCategory, getFinanceSnapshot } from "@/features/finance/server/repository";
import { categoryInputSchema } from "@/types/finance-schemas";

export async function POST(request: Request) {
  try {
    const payload = categoryInputSchema.parse(await request.json());
    await createCategory(payload);
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.category.create");
  }
}
