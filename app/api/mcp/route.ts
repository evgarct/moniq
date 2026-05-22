/**
 * Moniq MCP Server — Streamable HTTP Transport (MCP 2025-03-26)
 *
 * MCP auth uses a bearer API key resolved through narrow SECURITY DEFINER
 * RPCs. Direct finance RPCs receive the key hash and resolve the user inside
 * Postgres before touching tenant data.
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

const TRANSACTION_KINDS = ["income", "expense", "transfer", "debt_payment"] as const;
const DIRECT_TRANSACTION_STATUSES = ["paid", "planned"] as const;
const READ_TRANSACTION_STATUSES = ["paid", "planned", "skipped"] as const;

type TransactionKind = (typeof TRANSACTION_KINDS)[number];
type DirectTransactionStatus = (typeof DIRECT_TRANSACTION_STATUSES)[number];
type ReadTransactionStatus = (typeof READ_TRANSACTION_STATUSES)[number];

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

interface DirectTransactionItem {
  title?: unknown;
  note?: unknown;
  occurred_at?: unknown;
  status?: unknown;
  kind?: unknown;
  amount?: unknown;
  destination_amount?: unknown;
  fx_rate?: unknown;
  principal_amount?: unknown;
  interest_amount?: unknown;
  extra_principal_amount?: unknown;
  category_id?: unknown;
  source_account_id?: unknown;
  destination_account_id?: unknown;
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
          name: "get_finance_context",
          description:
            "Read the user's Moniq wallet and category context before creating transactions. Use this first so you can choose exact account IDs and category IDs. Categories include hierarchical paths and selectable flags; use category IDs, never free-text category names.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: "get_card_and_debt_balances",
          description:
            "Quickly read current Moniq balances for card-like wallets and debts only. Use this when the user asks for card balances, credit card debt, loans, mortgages, or total debts. Debit cards are cash wallets with cash_kind=debit_card; credit cards and debt wallets include outstanding_amount so you do not have to infer sign conventions.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: "get_transactions",
          description:
            "Read all Moniq transactions for an inclusive date range, including past paid transactions, planned/skipped entries, one-off future transactions, and generated recurring schedule occurrences. Use this for retrospective analytics and future cash-flow forecasting. Generated recurring occurrences are returned with source=schedule, is_generated=true, and stable synthetic IDs.",
          inputSchema: {
            type: "object",
            properties: {
              start_date: {
                type: "string",
                description: "Inclusive period start date in YYYY-MM-DD format.",
              },
              end_date: {
                type: "string",
                description: "Inclusive period end date in YYYY-MM-DD format.",
              },
              statuses: {
                type: "array",
                items: { type: "string", enum: READ_TRANSACTION_STATUSES },
                description: "Optional statuses to include. Defaults to paid, planned, and skipped.",
              },
              kinds: {
                type: "array",
                items: { type: "string", enum: TRANSACTION_KINDS },
                description: "Optional transaction kinds to include. Defaults to income, expense, transfer, and debt_payment.",
              },
              account_ids: {
                type: "array",
                items: { type: "string" },
                description: "Optional source or destination wallet IDs to include.",
              },
              category_ids: {
                type: "array",
                items: { type: "string" },
                description: "Optional category IDs to include. Transfers without categories are excluded when this filter is set.",
              },
              include_context: {
                type: "boolean",
                description: "When true, include matching account, category, and schedule context in the response.",
              },
            },
            required: ["start_date", "end_date"],
            additionalProperties: false,
          },
        },
        {
          name: "create_transactions",
          description:
            "Create complete Moniq transactions directly in the ledger after you have clarified every required field with the user. Call get_finance_context first, then use exact wallet IDs and selectable category IDs from that context. Ask the user for missing date, amount, kind, wallet, category, transfer destination, or debt-payment breakdown before calling this tool. Preserve useful source details in note; send null or omit note when no detail is known.",
          inputSchema: {
            type: "object",
            properties: {
              transactions: {
                type: "array",
                minItems: 1,
                description: "Complete transactions to create directly in Moniq.",
                items: {
                  type: "object",
                  required: ["title", "amount", "occurred_at", "status", "kind"],
                  properties: {
                    title: { type: "string", description: "Merchant, payer, or concise transaction title." },
                    note: { type: ["string", "null"], description: "Useful extra context, original label, or user-provided details." },
                    occurred_at: { type: "string", description: "Transaction date in YYYY-MM-DD format." },
                    status: { type: "string", enum: DIRECT_TRANSACTION_STATUSES, description: "Use paid for settled transactions and planned for upcoming ones." },
                    kind: { type: "string", enum: TRANSACTION_KINDS },
                    amount: { type: "number", description: "Positive source-side amount." },
                    destination_amount: { type: ["number", "null"], description: "Transfer destination amount; omit/null to use amount." },
                    fx_rate: { type: ["number", "null"], description: "Optional transfer FX rate." },
                    principal_amount: { type: ["number", "null"], description: "Debt payment principal component." },
                    interest_amount: { type: ["number", "null"], description: "Debt payment interest component." },
                    extra_principal_amount: { type: ["number", "null"], description: "Debt payment extra principal component." },
                    category_id: { type: ["string", "null"], description: "Required for income/expense. Optional expense category for debt payment interest. Never set for transfers." },
                    source_account_id: { type: ["string", "null"], description: "Required for expense, transfer, and debt payment." },
                    destination_account_id: { type: ["string", "null"], description: "Required for income, transfer, and debt payment. Debt payment destination must be a debt wallet." },
                  },
                },
              },
            },
            required: ["transactions"],
            additionalProperties: false,
          },
        },
        {
          name: "submit_transaction_batch",
          description:
            "Legacy review flow: submit a batch of transactions extracted from a bank screenshot, statement, or file for review inside Moniq. Use this when confidence is low or the user explicitly wants inbox approval instead of direct ledger writes.",
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

function getOptionalBooleanArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  return typeof value === "boolean" ? value : undefined;
}

function getOptionalStringArrayArg(args: Record<string, unknown>, key: string) {
  const value = args[key];
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return null;

  const normalized = value.map((item) => (typeof item === "string" ? item.trim() : ""));
  if (normalized.some((item) => !item)) return null;

  return normalized;
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

async function handleGetTransactionsTool(
  id: string | number | null,
  args: Record<string, unknown>,
  keyHash: string,
): Promise<McpResponse> {
  const startDate = getOptionalStringArg(args, "start_date");
  const endDate = getOptionalStringArg(args, "end_date");

  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: "start_date and end_date must be provided in YYYY-MM-DD format" },
    };
  }

  if (startDate > endDate) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: "start_date must be on or before end_date" },
    };
  }

  const statuses = getOptionalStringArrayArg(args, "statuses");
  const kinds = getOptionalStringArrayArg(args, "kinds");
  const accountIds = getOptionalStringArrayArg(args, "account_ids");
  const categoryIds = getOptionalStringArrayArg(args, "category_ids");

  if (statuses === null || statuses?.some((status) => !READ_TRANSACTION_STATUSES.includes(status as ReadTransactionStatus))) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: "statuses must contain only paid, planned, or skipped" },
    };
  }

  if (kinds === null || kinds?.some((kind) => !TRANSACTION_KINDS.includes(kind as TransactionKind))) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: "kinds must contain only income, expense, transfer, or debt_payment" },
    };
  }

  if (accountIds === null) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: "account_ids must be an array of non-empty strings" } };
  }

  if (categoryIds === null) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: "category_ids must be an array of non-empty strings" } };
  }

  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_get_transactions_for_period", {
    p_key_hash: keyHash,
    p_start_date: startDate,
    p_end_date: endDate,
    p_statuses: statuses ?? null,
    p_kinds: kinds ?? null,
    p_account_ids: accountIds ?? null,
    p_category_ids: categoryIds ?? null,
    p_include_context: getOptionalBooleanArg(args, "include_context") ?? false,
  });

  if (error || !data) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message ?? "Failed to load transactions" },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
      structuredContent: data,
    },
  };
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));

  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isKind(value: unknown): value is TransactionKind {
  return typeof value === "string" && TRANSACTION_KINDS.includes(value as TransactionKind);
}

function isStatus(value: unknown): value is DirectTransactionStatus {
  return typeof value === "string" && DIRECT_TRANSACTION_STATUSES.includes(value as DirectTransactionStatus);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateDirectTransaction(tx: unknown, index: number): string | null {
  if (!isRecord(tx)) return `Transaction ${index + 1} must be an object`;

  const label = typeof tx.title === "string" && tx.title.trim() ? tx.title.trim() : `transaction ${index + 1}`;

  if (!tx.title || typeof tx.title !== "string" || !tx.title.trim()) return `Transaction ${index + 1} must have a title`;
  if (!isPositiveNumber(tx.amount)) return `Transaction "${label}" must have a positive amount`;
  if (!isIsoDate(tx.occurred_at)) return `Transaction "${label}" must have occurred_at in YYYY-MM-DD format`;
  if (!isStatus(tx.status)) return `Transaction "${label}" status must be "paid" or "planned"`;
  if (!isKind(tx.kind)) return `Transaction "${label}" kind must be one of income, expense, transfer, debt_payment`;
  if (tx.note != null && typeof tx.note !== "string") return `Transaction "${label}" note must be a string or null`;

  if (tx.destination_amount != null && !isPositiveNumber(tx.destination_amount)) {
    return `Transaction "${label}" destination_amount must be positive when provided`;
  }
  if (tx.fx_rate != null && !isPositiveNumber(tx.fx_rate)) {
    return `Transaction "${label}" fx_rate must be positive when provided`;
  }

  if (tx.kind === "income") {
    if (!optionalString(tx.destination_account_id)) return `Transaction "${label}" income must include destination_account_id`;
    if (!optionalString(tx.category_id)) return `Transaction "${label}" income must include category_id`;
    if (optionalString(tx.source_account_id)) return `Transaction "${label}" income must not include source_account_id`;
  }

  if (tx.kind === "expense") {
    if (!optionalString(tx.source_account_id)) return `Transaction "${label}" expense must include source_account_id`;
    if (!optionalString(tx.category_id)) return `Transaction "${label}" expense must include category_id`;
    if (optionalString(tx.destination_account_id)) return `Transaction "${label}" expense must not include destination_account_id`;
  }

  if (tx.kind === "transfer") {
    if (!optionalString(tx.source_account_id)) return `Transaction "${label}" transfer must include source_account_id`;
    if (!optionalString(tx.destination_account_id)) return `Transaction "${label}" transfer must include destination_account_id`;
    if (optionalString(tx.category_id)) return `Transaction "${label}" transfer must not include category_id`;
  }

  if (tx.kind === "debt_payment") {
    if (!optionalString(tx.source_account_id)) return `Transaction "${label}" debt_payment must include source_account_id`;
    if (!optionalString(tx.destination_account_id)) return `Transaction "${label}" debt_payment must include destination_account_id`;

    const principal = tx.principal_amount ?? 0;
    const interest = tx.interest_amount ?? 0;
    const extra = tx.extra_principal_amount ?? 0;
    if (!isNonNegativeNumber(principal) || !isNonNegativeNumber(interest) || !isNonNegativeNumber(extra)) {
      return `Transaction "${label}" debt payment breakdown values must be non-negative`;
    }
    if (principal + interest + extra <= 0) {
      return `Transaction "${label}" debt_payment must include at least one breakdown amount`;
    }
    if (Math.abs(principal + interest + extra - tx.amount) > 0.01) {
      return `Transaction "${label}" amount must equal principal_amount + interest_amount + extra_principal_amount`;
    }
  }

  return null;
}

function normalizeDirectTransaction(tx: DirectTransactionItem) {
  return {
    title: (tx.title as string).trim(),
    note: optionalString(tx.note),
    occurred_at: tx.occurred_at,
    status: tx.status,
    kind: tx.kind,
    amount: tx.amount,
    destination_amount: tx.kind === "transfer" ? tx.destination_amount ?? null : null,
    fx_rate: tx.kind === "transfer" ? tx.fx_rate ?? null : null,
    principal_amount: tx.kind === "debt_payment" ? tx.principal_amount ?? 0 : null,
    interest_amount: tx.kind === "debt_payment" ? tx.interest_amount ?? 0 : null,
    extra_principal_amount: tx.kind === "debt_payment" ? tx.extra_principal_amount ?? 0 : null,
    category_id: tx.kind === "transfer" ? null : optionalString(tx.category_id),
    source_account_id: tx.kind === "income" ? null : optionalString(tx.source_account_id),
    destination_account_id: tx.kind === "expense" ? null : optionalString(tx.destination_account_id),
  };
}

function toNumber(value: number | string | null | undefined) {
  if (value == null) return null;
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function summarizeByCurrency(items: Array<{ currency: CurrencyCode; amount: number }>) {
  const totals = new Map<CurrencyCode, number>();

  for (const item of items) {
    totals.set(item.currency, (totals.get(item.currency) ?? 0) + item.amount);
  }

  return Array.from(totals.entries(), ([currency, amount]) => ({ currency, amount }));
}

function buildCardAndDebtBalances(context: { wallets?: WalletRow[] }) {
  const wallets = Array.isArray(context.wallets) ? context.wallets : [];
  const cards = wallets
    .filter((wallet) => wallet.type === "credit_card" || wallet.cash_kind === "debit_card")
    .map((wallet) => {
      const balance = toNumber(wallet.balance) ?? 0;
      const creditLimit = toNumber(wallet.credit_limit);
      const outstandingAmount = wallet.type === "credit_card" ? Math.abs(Math.min(balance, 0)) : 0;

      return {
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        cash_kind: wallet.cash_kind ?? null,
        currency: wallet.currency,
        balance,
        credit_limit: creditLimit,
        outstanding_amount: outstandingAmount,
        available_credit: wallet.type === "credit_card" && creditLimit != null ? creditLimit - outstandingAmount : null,
      };
    });

  const debts = wallets
    .filter((wallet) => wallet.type === "debt")
    .map((wallet) => {
      const balance = toNumber(wallet.balance) ?? 0;
      return {
        id: wallet.id,
        name: wallet.name,
        type: wallet.type,
        debt_kind: wallet.debt_kind ?? null,
        currency: wallet.currency,
        balance,
        outstanding_amount: Math.abs(Math.min(balance, 0)),
      };
    });

  return {
    cards,
    debts,
    totals_by_currency: {
      card_balances: summarizeByCurrency(cards.map((card) => ({ currency: card.currency, amount: card.balance }))),
      credit_card_outstanding: summarizeByCurrency(
        cards
          .filter((card) => card.type === "credit_card")
          .map((card) => ({ currency: card.currency, amount: card.outstanding_amount })),
      ),
      debts_outstanding: summarizeByCurrency(debts.map((debt) => ({ currency: debt.currency, amount: debt.outstanding_amount }))),
    },
  };
}

async function handleGetFinanceContext(id: string | number | null, keyHash: string): Promise<McpResponse> {
  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_get_finance_context", { p_key_hash: keyHash });

  if (error || !data) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message ?? "Failed to load finance context" },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify(data, null, 2),
        },
      ],
      structuredContent: data,
    },
  };
}

async function handleGetCardAndDebtBalances(id: string | number | null, keyHash: string): Promise<McpResponse> {
  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_get_finance_context", { p_key_hash: keyHash });

  if (error || !data) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message ?? "Failed to load balances" },
    };
  }

  const balances = buildCardAndDebtBalances(data as { wallets?: WalletRow[] });

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify(balances, null, 2),
        },
      ],
      structuredContent: balances,
    },
  };
}

async function handleCreateTransactions(
  id: string | number | null,
  params: Record<string, unknown>,
  keyHash: string,
): Promise<McpResponse> {
  const args = (params.arguments ?? {}) as { transactions?: unknown[] };
  const transactions = args.transactions;

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: "transactions must be a non-empty array" } };
  }

  for (let index = 0; index < transactions.length; index += 1) {
    const error = validateDirectTransaction(transactions[index], index);
    if (error) return { jsonrpc: "2.0", id, error: { code: -32602, message: error } };
  }

  const db = createAnonClient();
  const normalized = (transactions as DirectTransactionItem[]).map(normalizeDirectTransaction);
  const { data, error } = await db.rpc("mcp_create_transactions", {
    p_key_hash: keyHash,
    p_transactions: normalized,
  });

  if (error || !data) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message ?? "Failed to create transactions" },
    };
  }

  const created = Array.isArray(data) ? data.length : ((data as { created?: unknown[] }).created?.length ?? normalized.length);

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: `Created ${created} transaction${created === 1 ? "" : "s"} in Moniq.`,
        },
      ],
      structuredContent: data,
    },
  };
}

async function handleToolCall(
  id: string | number | null,
  params: Record<string, unknown>,
  auth: { userId: string; keyHash: string },
): Promise<McpResponse> {
  const toolName = params.name as string;

  if (toolName === "get_finance_context") {
    return handleGetFinanceContext(id, auth.keyHash);
  }

  if (toolName === "get_card_and_debt_balances") {
    return handleGetCardAndDebtBalances(id, auth.keyHash);
  }

  if (toolName === "get_transactions") {
    return handleGetTransactionsTool(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash);
  }

  if (toolName === "create_transactions") {
    return handleCreateTransactions(id, params, auth.keyHash);
  }

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
    if (!isPositiveNumber(tx.amount)) {
      return { jsonrpc: "2.0", id, error: { code: -32602, message: `Transaction "${tx.title}" must have a positive amount` } };
    }
    if (!isIsoDate(tx.occurred_at)) {
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
    note: tx.note?.trim() || null,
    suggested_category_name: tx.suggested_category_name?.trim() || null,
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
      error: { code: -32000, message: error?.message ?? "Failed to save batch in database" },
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
