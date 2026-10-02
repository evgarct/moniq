import { NextResponse } from "next/server";

import { getFinanceSnapshot } from "@/features/finance/server/repository";
import { financeSnapshotErrorResponse } from "@/app/api/_lib/error-response";

export async function POST(request: Request) {
  try {
    await getFinanceSnapshot({ reconcileSchedules: true });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return financeSnapshotErrorResponse(request, error);
  }
}
