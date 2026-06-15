import { NextResponse } from "next/server";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { searchInvestmentInstruments } from "@/features/investments/server/repository";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Unauthorized");
    const query = new URL(request.url).searchParams.get("q") ?? "";
    return NextResponse.json(await searchInvestmentInstruments(query));
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.investment.search");
  }
}
