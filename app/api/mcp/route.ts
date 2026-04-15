/**
 * Moniq MCP Server — Streamable HTTP Transport
 *
 * Implements the Model Context Protocol over HTTP so Claude can submit
 * transaction batches for review inside Moniq.
 *
 * Configure in Claude:
 *   ~/.claude/settings.json → mcpServers → moniq
 *   { "type": "http", "url": "<host>/api/mcp", "headers": { "Authorization": "Bearer <api-key>" } }
 *
 * Exposed tools:
 *   submit_transaction_batch — send a list of transactions with suggested categories
 */

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface McpRequest {
  jsonrpc: "2.0";
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

interface McpResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

interface BatchTransactionItem {
  title: string;
  amount: number;
  occurred_at: string; // ISO date string YYYY-MM-DD
  kind: "income" | "expense";
  suggested_category_name?: string;
  currency?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Auth helper: validate Bearer API key
// ---------------------------------------------------------------------------

async function authenticateApiKey(
  request: Request,
): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return null;

  const keyHash = createHash("sha256").update(rawKey).digest("hex");

  // Use service role to bypass RLS — the API key lookup is by secret hash,
  // no user session exists at this point.
  const service = createServiceClient();

  const { data, error } = await service
    .from("mcp_api_keys")
    .select("id, user_id")
    .eq("key_hash", keyHash)
    .single();

  if (error || !data) return null;

  // Update last_used_at
  await service
    .from("mcp_api_keys")
    .update({ last_used_at: new Date().toISOString() })
    .eq("id", data.id);

  return { userId: data.user_id };
}

// ---------------------------------------------------------------------------
// MCP message handlers
// ---------------------------------------------------------------------------

function handleInitialize(id: string | number | null): McpResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion: "2024-11-05",
      capabilities: {
        tools: {},
      },
      serverInfo: {
        name: "moniq",
        version: "1.0.0",
      },
    },
  };
}

function handleToolsList(id: string | number | null): McpResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      tools: [
        {
          name: "submit_transaction_batch",
          description:
            "Submit a batch of transactions extracted from a bank screenshot, statement, or file for review inside Moniq. Each transaction gets a suggested category. The user reviews and approves them in the Moniq Claude Inbox.",
          inputSchema: {
            type: "object",
            properties: {
              transactions: {
                type: "array",
                description: "List of transactions to submit for review.",
                items: {
                  type: "object",
                  required: ["title", "amount", "occurred_at", "kind"],
                  properties: {
                    title: {
                      type: "string",
                      description: "Merchant name or transaction description.",
                    },
                    amount: {
                      type: "number",
                      description: "Absolute transaction amount (always positive).",
                    },
                    occurred_at: {
                      type: "string",
                      description: "Transaction date in YYYY-MM-DD format.",
                    },
                    kind: {
                      type: "string",
                      enum: ["income", "expense"],
                      description: "Whether this is income or an expense.",
                    },
                    suggested_category_name: {
                      type: "string",
                      description:
                        "Your best guess at a category name (e.g. 'Groceries', 'Transport', 'Salary'). The user can override it during review.",
                    },
                    currency: {
                      type: "string",
                      description: "3-letter ISO currency code (e.g. EUR, USD, RUB). Optional.",
                    },
                    note: {
                      type: "string",
                      description: "Any extra context or original bank label. Optional.",
                    },
                  },
                },
                minItems: 1,
              },
              source_description: {
                type: "string",
                description:
                  "Brief description of where these transactions came from (e.g. 'Tinkoff screenshot March 2025', 'Revolut CSV export').",
              },
            },
            required: ["transactions"],
          },
        },
      ],
    },
  };
}

async function handleToolCall(
  id: string | number | null,
  params: Record<string, unknown>,
  userId: string,
): Promise<McpResponse> {
  const toolName = params.name as string;

  if (toolName !== "submit_transaction_batch") {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Unknown tool: ${toolName}` },
    };
  }

  const args = (params.arguments ?? {}) as {
    transactions?: BatchTransactionItem[];
    source_description?: string;
  };

  const transactions = args.transactions;
  if (!Array.isArray(transactions) || transactions.length === 0) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: "transactions must be a non-empty array" },
    };
  }

  // Validate items
  for (const tx of transactions) {
    if (!tx.title || typeof tx.title !== "string") {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: "Each transaction must have a title" },
      };
    }
    if (typeof tx.amount !== "number" || tx.amount <= 0) {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: `Transaction "${tx.title}" must have a positive amount` },
      };
    }
    if (!tx.occurred_at || !/^\d{4}-\d{2}-\d{2}$/.test(tx.occurred_at)) {
      return {
        jsonrpc: "2.0",
        id,
        error: {
          code: -32602,
          message: `Transaction "${tx.title}" must have occurred_at in YYYY-MM-DD format`,
        },
      };
    }
    if (tx.kind !== "income" && tx.kind !== "expense") {
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32602, message: `Transaction "${tx.title}" kind must be "income" or "expense"` },
      };
    }
  }

  const supabase = await createClient();

  // Create batch
  const { data: batch, error: batchError } = await supabase
    .from("mcp_transaction_batches")
    .insert({
      user_id: userId,
      status: "pending",
      source_description: args.source_description ?? null,
      submitted_by: "claude",
    })
    .select("id")
    .single();

  if (batchError || !batch) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: "Failed to create batch in database" },
    };
  }

  // Insert batch items
  const items = transactions.map((tx) => ({
    batch_id: batch.id,
    user_id: userId,
    title: tx.title.trim(),
    amount: tx.amount,
    occurred_at: tx.occurred_at,
    kind: tx.kind,
    currency: tx.currency ?? null,
    note: tx.note?.trim() ?? null,
    suggested_category_name: tx.suggested_category_name?.trim() ?? null,
    status: "pending",
  }));

  const { error: itemsError } = await supabase.from("mcp_batch_items").insert(items);

  if (itemsError) {
    // Clean up the batch
    await supabase.from("mcp_transaction_batches").delete().eq("id", batch.id);
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: "Failed to save transaction items" },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: `Batch submitted successfully. ${transactions.length} transaction${transactions.length === 1 ? "" : "s"} are now in the Moniq Claude Inbox for review. Batch ID: ${batch.id}`,
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Main route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  // Authenticate
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: { code: -32001, message: "Unauthorized: provide a valid Moniq API key as Bearer token" },
      },
      { status: 401 },
    );
  }

  let body: McpRequest | McpRequest[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400 },
    );
  }

  // Handle batched requests
  if (Array.isArray(body)) {
    const responses = await Promise.all(
      body.map((msg) => dispatchMessage(msg, auth.userId)),
    );
    const nonNullResponses = responses.filter(Boolean);
    return NextResponse.json(nonNullResponses);
  }

  const response = await dispatchMessage(body, auth.userId);
  if (response === null) {
    // Notification — no response
    return new NextResponse(null, { status: 204 });
  }
  return NextResponse.json(response);
}

async function dispatchMessage(
  msg: McpRequest,
  userId: string,
): Promise<McpResponse | null> {
  const id = msg.id ?? null;

  switch (msg.method) {
    case "initialize":
      return handleInitialize(id);

    case "notifications/initialized":
    case "initialized":
      // Notifications — no response
      return null;

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return handleToolsList(id);

    case "tools/call":
      return handleToolCall(id, (msg.params ?? {}) as Record<string, unknown>, userId);

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${msg.method}` },
      };
  }
}
