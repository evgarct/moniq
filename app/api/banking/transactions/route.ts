import { NextResponse } from "next/server";

import { bankingSnapshotErrorResponse } from "@/app/api/_lib/error-response";
import { getBankingSnapshot } from "@/features/banking/server/repository";

export async function GET(request: Request) {
  try {
    const status = new URL(request.url).searchParams.get("status");
    const snapshot = await getBankingSnapshot();

    if (status === "draft") {
      return NextResponse.json({ transactions: snapshot.draftTransactions });
    }

    if (status === "confirmed") {
      return NextResponse.json({ transactions: snapshot.confirmedTransactions });
    }

    return NextResponse.json({
      transactions: [...snapshot.draftTransactions, ...snapshot.confirmedTransactions],
    });
  } catch (error) {
    return bankingSnapshotErrorResponse(request, error);
  }
}
