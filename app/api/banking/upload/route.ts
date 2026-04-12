import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { uploadCsvImport } from "@/features/banking/server/repository";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const walletId = String(formData.get("walletId") ?? "").trim();
    const mappingValue = String(formData.get("mapping") ?? "").trim();

    if (!(file instanceof File)) {
      throw new Error("Choose a CSV file to import.");
    }

    if (!walletId) {
      throw new Error("Choose a wallet before importing.");
    }

    const mapping = mappingValue ? JSON.parse(mappingValue) : null;
    const fileBuffer = new Uint8Array(await file.arrayBuffer());
    const snapshot = await uploadCsvImport({
      walletId,
      fileName: file.name,
      fileBuffer,
      mapping,
    });

    return NextResponse.json(snapshot);
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.imports.upload");
  }
}
