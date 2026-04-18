import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const updateItemSchema = z.object({
  title: z.string().trim().min(1).optional(),
  amount: z.number().positive().optional(),
  occurred_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  kind: z.enum(["income", "expense", "transfer", "save_to_goal", "spend_from_goal", "debt_payment", "investment", "refund", "adjustment"]).optional(),
  note: z.string().max(500).nullable().optional(),
  resolved_category_id: z.string().uuid().nullable().optional(),
  resolved_account_id: z.string().uuid().nullable().optional(),
  resolved_destination_account_id: z.string().uuid().nullable().optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
});

// PATCH /api/mcp/batches/[batchId]/items/[itemId]
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ batchId: string; itemId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { batchId, itemId } = await params;

  // Verify batch belongs to user and is still pending
  const { data: batch, error: batchError } = await supabase
    .from("mcp_transaction_batches")
    .select("id, status")
    .eq("id", batchId)
    .eq("user_id", user.id)
    .single();

  if (batchError || !batch) {
    return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  }

  if (batch.status !== "pending") {
    return NextResponse.json({ error: "Batch has already been reviewed" }, { status: 409 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("mcp_batch_items")
    .update(parsed.data)
    .eq("id", itemId)
    .eq("batch_id", batchId)
    .eq("user_id", user.id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
