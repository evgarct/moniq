import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { getImportPreview } from "@/features/banking/server/repository";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      throw new Error("Choose a CSV file to import.");
    }

    const preview = await getImportPreview({
      fileName: file.name,
      fileBuffer: new Uint8Array(await file.arrayBuffer()),
    });

    return NextResponse.json(preview);
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.imports.upload");
  }
}
