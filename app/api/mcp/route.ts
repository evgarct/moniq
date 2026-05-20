/**
 * Moniq MCP Server — Streamable HTTP Transport (MCP 2025-03-26)
 *
 * All DB operations go through SECURITY DEFINER RPC functions so we never
 * need the Supabase service role key — the public anon key is sufficient.
 */

import { createHash } from "crypto";
import { NextResponse } from "next/server";
import {
  buildCategorySpendingReport,
  resolveCategorySpendingPeriod,
  type CategorySpendingPeriodInput,
} from "@/features/finance/lib/category-spending-report";
import { createAnonClient } from "@/lib/supabase/anon";
import type { CurrencyCode } from "@/types/currency";
import type { Account, Category, Transaction } from "@/types/finance";

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
const WWW_AUTHENTICATE =
  'Bearer realm="moniq", resource_metadata="https://moniq.safronov.dev/.well-known/oauth-protected-resource"';

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return new Response(null, {
      status: 401,
      headers: { ...CORS_HEADERS, "WWW-Authenticate": WWW_AUTHENTICATE },
    });
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

type WalletRow = {
  id: string;
  user_id: string;
  name: string;
  type: Account["type"];
  cash_kind: Account["cash_kind"];
  debt_kind: Account["debt_kind"];
  balance: number | string;
  credit_limit: number | string | null;
  currency: CurrencyCode;
  created_at: string;
};

type CategoryRow = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  icon: string | null;
  type: Category["type"];
  parent_id: string | null;
  is_system: boolean;
  created_at: string;
};

type TransactionRow = {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  occurred_at: string;
  created_at: string;
  status: Transaction["status"];
  kind: Transaction["kind"];
  amount: number | string;
  destination_amount: number | string | null;
  fx_rate: number | string | null;
  principal_amount: number | string | null;
  interest_amount: number | string | null;
  extra_principal_amount: number | string | null;
  category_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  schedule_id: string | null;
  schedule_occurrence_date: string | null;
  is_schedule_override: boolean | null;
  allocation_id: string | null;
};

// ---------------------------------------------------------------------------
// Auth: validate Bearer API key via RPC (no service role needed)
// ---------------------------------------------------------------------------

async function authenticateApiKey(
  request: Request,
): Promise<{ userId: string; keyHash: string } | null> {
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

  return { userId: row.user_id, keyHash };
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

export function getMcpTools() {
  return [
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
        {
          name: "get_category_spending_report",
          description:
            "Read Moniq category spending analytics for a period. Defaults to the last fully completed calendar month. Returns paid transactions grouped by root expense envelopes and income categories, with totals and percentages separated by currency.",
          inputSchema: {
            type: "object",
            properties: {
              period_preset: {
                type: "string",
                enum: ["last_complete_month"],
                description:
                  "Optional preset. Use last_complete_month to report the last fully completed calendar month.",
              },
              month: {
                type: "string",
                description: "Calendar month in YYYY-MM format. Mutually exclusive with start_date/end_date.",
              },
              start_date: {
                type: "string",
                description: "Inclusive custom period start date in YYYY-MM-DD format.",
              },
              end_date: {
                type: "string",
                description: "Inclusive custom period end date in YYYY-MM-DD format.",
              },
            },
            additionalProperties: false,
          },
        },
      ];
}

function handleToolsList(id: string | number | null): McpResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      tools: getMcpTools(),
    },
  };
}

function mapWallet(row: WalletRow): Account {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    type: row.type,
    cash_kind: row.cash_kind,
    debt_kind: row.debt_kind,
    balance: Number(row.balance),
    credit_limit: row.credit_limit === null ? null : Number(row.credit_limit),
    currency: row.currency,
    created_at: row.created_at,
  };
}

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    type: row.type,
    parent_id: row.parent_id,
    is_system: row.is_system,
    created_at: row.created_at,
  };
}

function mapTransaction(
  row: TransactionRow,
  options: {
    accountsById: Map<string, Account>;
    categoriesById: Map<string, Category>;
  },
): Transaction {
  return {
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    note: row.note,
    occurred_at: row.occurred_at,
    created_at: row.created_at,
    status: row.status,
    kind: row.kind,
    amount: Number(row.amount),
    destination_amount: row.destination_amount === null ? null : Number(row.destination_amount),
    fx_rate: row.fx_rate === null ? null : Number(row.fx_rate),
    principal_amount: row.principal_amount === null ? null : Number(row.principal_amount),
    interest_amount: row.interest_amount === null ? null : Number(row.interest_amount),
    extra_principal_amount: row.extra_principal_amount === null ? null : Number(row.extra_principal_amount),
    category_id: row.category_id,
    source_account_id: row.source_account_id,
    destination_account_id: row.destination_account_id,
    schedule_id: row.schedule_id,
    schedule_occurrence_date: row.schedule_occurrence_date,
    is_schedule_override: row.is_schedule_override ?? false,
    allocation_id: row.allocation_id ?? null,
    category: row.category_id ? options.categoriesById.get(row.category_id) ?? null : null,
    source_account: row.source_account_id ? options.accountsById.get(row.source_account_id) ?? null : null,
    destination_account: row.destination_account_id ? options.accountsById.get(row.destination_account_id) ?? null : null,
    schedule: null,
    allocation: null,
  };
}

function getOptionalStringArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

async function handleCategorySpendingReportTool(
  id: string | number | null,
  args: Record<string, unknown>,
  keyHash: string,
): Promise<McpResponse> {
  const period: CategorySpendingPeriodInput = {
    period_preset: getOptionalStringArg(args, "period_preset") as CategorySpendingPeriodInput["period_preset"],
    month: getOptionalStringArg(args, "month"),
    start_date: getOptionalStringArg(args, "start_date"),
    end_date: getOptionalStringArg(args, "end_date"),
  };
  let resolvedPeriod: ReturnType<typeof resolveCategorySpendingPeriod>;

  try {
    resolvedPeriod = resolveCategorySpendingPeriod(period);
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: error instanceof Error ? error.message : "Invalid spending report period" },
    };
  }

  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_get_category_spending_report_source", {
    p_key_hash: keyHash,
    p_start_date: resolvedPeriod.start_date,
    p_end_date: resolvedPeriod.end_date,
  });

  if (error || !data) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: "Failed to load finance data for spending report" },
    };
  }

  const source = data as {
    wallets?: WalletRow[];
    categories?: CategoryRow[];
    transactions?: TransactionRow[];
  };
  const accounts = (source.wallets ?? []).map(mapWallet);
  const categories = (source.categories ?? []).map(mapCategory);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const transactions = (source.transactions ?? []).map((transaction) =>
    mapTransaction(transaction, { accountsById, categoriesById }),
  );

  let report: ReturnType<typeof buildCategorySpendingReport>;
  try {
    report = buildCategorySpendingReport({
      categories,
      transactions,
      period: {
        start_date: resolvedPeriod.start_date,
        end_date: resolvedPeriod.end_date,
      },
    });
    report.period = resolvedPeriod;
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: error instanceof Error ? error.message : "Invalid spending report period" },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify(report, null, 2),
        },
      ],
      structuredContent: report,
    },
  };
}

async function handleToolCall(
  id: string | number | null,
  params: Record<string, unknown>,
  auth: { userId: string; keyHash: string },
): Promise<McpResponse> {
  const toolName = params.name as string;

  if (toolName === "get_category_spending_report") {
    return handleCategorySpendingReportTool(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash);
  }

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
    p_user_id: auth.userId,
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
      { status: 401, headers: { ...CORS_HEADERS, "WWW-Authenticate": WWW_AUTHENTICATE } },
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
    const responses = await Promise.all(body.map((msg) => dispatchMessage(msg, auth)));
    return NextResponse.json(responses.filter(Boolean), { headers: CORS_HEADERS });
  }

  const response = await dispatchMessage(body, auth);
  if (response === null) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  return NextResponse.json(response, { headers: CORS_HEADERS });
}

async function dispatchMessage(msg: McpRequest, auth: { userId: string; keyHash: string }): Promise<McpResponse | null> {
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
      return handleToolCall(id, (msg.params ?? {}) as Record<string, unknown>, auth);

    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: `Method not found: ${msg.method}` } };
  }
}
