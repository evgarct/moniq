import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/mcp/batches — list batches for current user
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const status = url.searchParams.get("status") ?? "pending";

  const { data, error } = await supabase
    .from("mcp_transaction_batches")
    .select(`
      id,
      status,
      source_description,
      submitted_by,
      created_at,
      reviewed_at,
      mcp_batch_items (
        id,
        title,
        amount,
        occurred_at,
        kind,
        currency,
        note,
        suggested_category_name,
        status,
        resolved_category_id,
        resolved_account_id,
        finance_transaction_id,
        created_at
      )
    `)
    .eq("user_id", user.id)
    .eq("status", status)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
