import { NextResponse } from "next/server";

import { getFinanceSnapshot } from "@/features/finance/server/repository";

export async function GET() {
  try {
    const snapshot = await getFinanceSnapshot();
    return NextResponse.json(snapshot);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to load finance data.";
    const status = message === "Unauthorized" ? 401 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

