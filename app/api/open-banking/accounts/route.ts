import { NextResponse } from "next/server";

import { getAccounts } from "@/features/open-banking/server/repository";

export async function GET() {
  return NextResponse.json(await getAccounts());
}
