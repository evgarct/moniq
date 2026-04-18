import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

// GET /api/mcp/batches/[batchId] — batch details with items
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { batchId } = await params;

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
        resolved_destination_account_id,
        finance_transaction_id,
        created_at
      )
    `)
    .eq("id", batchId)
    .eq("user_id", user.id)
    .single();

  if (error) return NextResponse.json({ error: "Batch not found" }, { status: 404 });
  return NextResponse.json(data);
}

const approveSchema = z.object({
  action: z.enum(["approve", "reject"]),
});

// PATCH /api/mcp/batches/[batchId] — approve or reject entire batch
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ batchId: string }> },
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { batchId } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = approveSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "action must be 'approve' or 'reject'" }, { status: 400 });
  }

  // Fetch the batch and verify ownership
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

  if (parsed.data.action === "reject") {
    await supabase
      .from("mcp_transaction_batches")
      .update({ status: "rejected", reviewed_at: new Date().toISOString() })
      .eq("id", batchId);

    return NextResponse.json({ success: true });
  }

  // approve — fetch approved items and create finance_transactions
  const { data: items, error: itemsError } = await supabase
    .from("mcp_batch_items")
    .select("*")
    .eq("batch_id", batchId)
    .eq("status", "approved");

  if (itemsError) {
    return NextResponse.json({ error: itemsError.message }, { status: 500 });
  }

  // Create finance_transactions for approved items
  const createdIds: { itemId: string; transactionId: string }[] = [];

  // Kinds where resolved_account_id is the source (debit side)
  const SOURCE_KINDS = new Set(["expense", "transfer", "save_to_goal", "spend_from_goal", "debt_payment", "investment", "adjustment"]);
  // Kinds where resolved_account_id is the destination (credit side)
  const DEST_KINDS = new Set(["income", "refund"]);

  for (const item of items ?? []) {
    const sourceAccountId = SOURCE_KINDS.has(item.kind)
      ? (item.resolved_account_id ?? null)
      : null;
    const destinationAccountId = DEST_KINDS.has(item.kind)
      ? (item.resolved_account_id ?? null)
      : (item.resolved_destination_account_id ?? null);

    const { data: tx, error: txError } = await supabase
      .from("finance_transactions")
      .insert({
        user_id: user.id,
        title: item.title,
        note: item.note,
        occurred_at: item.occurred_at,
        status: "paid",
        kind: item.kind,
        amount: item.amount,
        category_id: item.resolved_category_id ?? null,
        source_account_id: sourceAccountId,
        destination_account_id: destinationAccountId,
      })
      .select("id")
      .single();

    if (!txError && tx) {
      createdIds.push({ itemId: item.id, transactionId: tx.id });
    }
  }

  // Update items with created transaction IDs
  for (const { itemId, transactionId } of createdIds) {
    await supabase
      .from("mcp_batch_items")
      .update({ finance_transaction_id: transactionId })
      .eq("id", itemId);
  }

  // Mark batch as approved
  await supabase
    .from("mcp_transaction_batches")
    .update({ status: "approved", reviewed_at: new Date().toISOString() })
    .eq("id", batchId);

  return NextResponse.json({ success: true, created: createdIds.length });
}
