/**
 * Moniq MCP Server — Streamable HTTP Transport (MCP 2025-03-26)
 *
 * All DB operations go through SECURITY DEFINER RPC functions so we never
 * need the Supabase service role key — the public anon key is sufficient.
 */

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { createAnonClient } from "@/lib/supabase/anon";

// ---------------------------------------------------------------------------
// CORS — required for Claude.ai (browser-based MCP client)
// ---------------------------------------------------------------------------

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

// GET — MCP 2025-03-26 SSE channel for server-initiated messages.
// Claude.ai opens this before sending POST; must return 200 + text/event-stream
// or Claude.ai rejects the server as unreachable ("Method Not Allowed").
// We don't push server-initiated events, so the stream stays idle until the
// client disconnects or Vercel's function timeout closes it.
export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return new Response(null, { status: 401, headers: CORS_HEADERS });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // Send an initial keepalive comment so the client knows we're alive.
      controller.enqueue(encoder.encode(": connected\n\n"));
      // We intentionally never close — the client disconnects when done.
      // Vercel will terminate after the function max duration.
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

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
  occurred_at: string;
  kind: "income" | "expense";
  suggested_category_name?: string;
  currency?: string;
  note?: string;
}

// ---------------------------------------------------------------------------
// Auth: validate Bearer API key via RPC (no service role needed)
// ---------------------------------------------------------------------------

async function authenticateApiKey(
  request: Request,
): Promise<{ userId: string } | null> {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const rawKey = authHeader.slice(7).trim();
  if (!rawKey) return null;

  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const db = createAnonClient();

  const { data, error } = await db.rpc("mcp_lookup_api_key", { p_key_hash: keyHash });
  if (error || !data || data.length === 0) return null;

  const row = data[0] as { id: string; user_id: string };

  // Fire-and-forget: update last_used_at
  db.rpc("mcp_touch_api_key", { p_key_id: row.id }).then(() => {});

  return { userId: row.user_id };
}

// ---------------------------------------------------------------------------
// MCP message handlers
// ---------------------------------------------------------------------------

function handleInitialize(
  id: string | number | null,
  params?: Record<string, unknown>,
): McpResponse {
  const requestedVersion = (params?.protocolVersion as string | undefined) ?? "2025-03-26";
  const supported = ["2025-03-26", "2024-11-05"];
  const protocolVersion = supported.includes(requestedVersion) ? requestedVersion : "2025-03-26";

  return {
    jsonrpc: "2.0",
    id,
    result: {
      protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: "moniq", version: "1.0.0" },
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
      return { jsonrpc: "2.0", id, error: { code: -32602, message: "Each transaction must have a title" } };
    }
    if (typeof tx.amount !== "number" || tx.amount <= 0) {
      return { jsonrpc: "2.0", id, error: { code: -32602, message: `Transaction "${tx.title}" must have a positive amount` } };
    }
    if (!tx.occurred_at || !/^\d{4}-\d{2}-\d{2}$/.test(tx.occurred_at)) {
      return { jsonrpc: "2.0", id, error: { code: -32602, message: `Transaction "${tx.title}" must have occurred_at in YYYY-MM-DD format` } };
    }
    if (tx.kind !== "income" && tx.kind !== "expense") {
      return { jsonrpc: "2.0", id, error: { code: -32602, message: `Transaction "${tx.title}" kind must be "income" or "expense"` } };
    }
  }

  const db = createAnonClient();

  // Submit batch + items via single atomic RPC call
  const items = transactions.map((tx) => ({
    title: tx.title.trim(),
    amount: tx.amount,
    occurred_at: tx.occurred_at,
    kind: tx.kind,
    currency: tx.currency ?? null,
    note: tx.note?.trim() ?? null,
    suggested_category_name: tx.suggested_category_name?.trim() ?? null,
  }));

  const { data: batchId, error } = await db.rpc("mcp_submit_batch", {
    p_user_id: userId,
    p_source_description: args.source_description ?? null,
    p_items: items,
  });

  if (error || !batchId) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: "Failed to save batch in database" },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: `Batch submitted successfully. ${transactions.length} transaction${transactions.length === 1 ? "" : "s"} are now in the Moniq Claude Inbox for review. Batch ID: ${batchId}`,
        },
      ],
    },
  };
}

// ---------------------------------------------------------------------------
// Main route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: "Unauthorized: provide a valid Moniq API key as Bearer token" } },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  let body: McpRequest | McpRequest[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: "Parse error" } },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map((msg) => dispatchMessage(msg, auth.userId)));
    return NextResponse.json(responses.filter(Boolean), { headers: CORS_HEADERS });
  }

  const response = await dispatchMessage(body, auth.userId);
  if (response === null) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  return NextResponse.json(response, { headers: CORS_HEADERS });
}

async function dispatchMessage(msg: McpRequest, userId: string): Promise<McpResponse | null> {
  const id = msg.id ?? null;

  switch (msg.method) {
    case "initialize":
      return handleInitialize(id, msg.params);

    case "notifications/initialized":
    case "initialized":
      return null;

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    case "tools/list":
      return handleToolsList(id);

    case "tools/call":
      return handleToolCall(id, (msg.params ?? {}) as Record<string, unknown>, userId);

    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${msg.method}` } };
  }
}
