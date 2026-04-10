import { NextResponse } from "next/server";

import { updateTransaction } from "@/features/open-banking/server/repository";

export async function PATCH(request: Request, { params }: { params: Promise<{ transactionId: string }> }) {
  const payload = await request.json();
  const { transactionId } = await params;
  return NextResponse.json(await updateTransaction(transactionId, payload));
}
