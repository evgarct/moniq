import { NextResponse } from "next/server";

import { getTransactions } from "@/features/open-banking/server/repository";

export async function GET(request: Request) {
  const status = new URL(request.url).searchParams.get("status") === "confirmed" ? "confirmed" : "draft";
  return NextResponse.json(await getTransactions(status));
}
