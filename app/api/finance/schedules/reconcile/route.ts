import { NextResponse } from "next/server";

import { getFinanceSnapshot } from "@/features/finance/server/repository";

export async function POST() {
  await getFinanceSnapshot({ reconcileSchedules: true });
  return NextResponse.json({ ok: true });
}
