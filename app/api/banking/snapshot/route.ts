import { NextResponse } from "next/server";

import { bankingSnapshotErrorResponse } from "@/app/api/_lib/error-response";
import { getBankingSnapshot } from "@/features/banking/server/repository";

export async function GET(request: Request) {
  try {
    const snapshot = await getBankingSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    return bankingSnapshotErrorResponse(request, error);
  }
}
