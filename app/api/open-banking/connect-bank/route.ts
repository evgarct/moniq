import { NextResponse } from "next/server";

import { connectBank, importAccountsFromRequisition } from "@/features/open-banking/server/repository";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (body.requisitionId) {
    const accounts = await importAccountsFromRequisition(body.requisitionId);
    return NextResponse.json({ accounts });
  }

  const requisition = await connectBank();
  return NextResponse.json({ requisition_id: requisition.id, link: requisition.link });
}
