import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { syncBankTransactions } from "@/features/banking/server/repository";

export async function POST(request: Request) {
  try {
    const snapshot = await syncBankTransactions();
    return NextResponse.json(snapshot);
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.banking.sync");
  }
}
