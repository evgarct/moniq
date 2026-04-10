import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { connectBank } from "@/features/banking/server/repository";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      redirectUrl?: string;
      aspspName?: string;
      aspspCountry?: string;
    };
    const result = await connectBank(body);
    return NextResponse.json(result);
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.banking.connect");
  }
}
