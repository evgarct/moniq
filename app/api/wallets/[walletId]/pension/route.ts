import { NextResponse } from "next/server";
import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { getFinanceSnapshot } from "@/features/finance/server/repository";
import { pensionStatementSchema } from "@/features/accounts/lib/pension";
import { requireMutationEntitlementForRequest } from "@/lib/billing/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request, { params }: { params: Promise<{ walletId: string }> }) {
  try {
    await requireMutationEntitlementForRequest(request);
    const parsed = pensionStatementSchema.safeParse(await request.json());
    if (!parsed.success) throw new Error("pension_statement_failed");
    const statement = parsed.data;
    const { walletId } = await params;
    const db = await createClient();
    const { error } = await db.rpc("upsert_pension_statement", { p_wallet_id: walletId, p_statement: statement });
    if (error) throw new Error("pension_statement_failed");
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) { return financeErrorResponse(request, error, "common.errors.wallet.update"); }
}
