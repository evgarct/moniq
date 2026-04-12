import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { deleteImportBatch } from "@/features/banking/server/repository";

export async function DELETE(request: Request, { params }: { params: Promise<{ batchId: string }> }) {
  try {
    const { batchId } = await params;
    const snapshot = await deleteImportBatch(batchId);
    return NextResponse.json(snapshot);
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.imports.delete");
  }
}
