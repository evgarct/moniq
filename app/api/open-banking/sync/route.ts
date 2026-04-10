import { NextResponse } from "next/server";

import { syncTransactions } from "@/features/open-banking/server/repository";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  return NextResponse.json(await syncTransactions(body.accountId));
}
