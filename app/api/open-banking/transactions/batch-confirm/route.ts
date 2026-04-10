import { NextResponse } from "next/server";

import { batchConfirm } from "@/features/open-banking/server/repository";

export async function POST(request: Request) {
  const payload = await request.json();
  return NextResponse.json(await batchConfirm(payload.ids ?? []));
}
