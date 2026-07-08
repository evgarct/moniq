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
import { getRequestTranslator } from "@/i18n/translator";
import { createAnonClient } from "@/lib/supabase/anon";
import type { CurrencyCode } from "@/types/currency";
import type { Account, Category, Transaction } from "@/types/finance";
import { getMcpWwwAuthenticate } from "./auth-metadata";
import {
  MONIQ_WIDGET_MIME_TYPE,
  MONIQ_WIDGET_RESOURCE_META,
  MONIQ_WIDGET_URI,
  moniqWidgetHtml,
  moniqWidgetMeta,
  type MoniqWidgetCopy,
} from "./widget";

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
const TRANSACTION_KINDS = ["income", "expense", "transfer", "debt_payment"] as const;
const DIRECT_TRANSACTION_STATUSES = ["paid", "planned"] as const;
const READ_TRANSACTION_STATUSES = ["paid", "planned", "skipped"] as const;
const SCHEDULE_FREQUENCIES = ["daily", "weekly", "monthly", "yearly"] as const;
const SCHEDULE_STATES = ["active", "paused"] as const;
type TransactionKind = (typeof TRANSACTION_KINDS)[number];
type DirectTransactionStatus = (typeof DIRECT_TRANSACTION_STATUSES)[number];
type ReadTransactionStatus = (typeof READ_TRANSACTION_STATUSES)[number];
type ScheduleFrequency = (typeof SCHEDULE_FREQUENCIES)[number];
type ScheduleState = (typeof SCHEDULE_STATES)[number];
type McpTranslator = (key: string, values?: Record<string, string | number | Date>) => string;

function getMoniqWidgetCopy(t: McpTranslator): MoniqWidgetCopy {
  return {
    locale: t("mcp.widget.locale"),
    numberLocale: t("mcp.widget.numberLocale"),
    transactions: t("mcp.widget.transactions"),
    balances: t("mcp.widget.balances"),
    report: t("mcp.widget.report"),
    recurring: t("mcp.widget.recurring"),
    result: t("mcp.widget.result"),
    empty: t("mcp.widget.empty"),
    more: t("mcp.widget.more"),
    count: t("mcp.widget.count"),
    paid: t("mcp.widget.paid"),
    planned: t("mcp.widget.planned"),
    skipped: t("mcp.widget.skipped"),
    active: t("mcp.widget.active"),
    paused: t("mcp.widget.paused"),
    income: t("mcp.widget.income"),
    expense: t("mcp.widget.expense"),
    transfer: t("mcp.widget.transfer"),
    debt_payment: t("mcp.widget.debtPayment"),
    daily: t("mcp.widget.daily"),
    weekly: t("mcp.widget.weekly"),
    monthly: t("mcp.widget.monthly"),
    yearly: t("mcp.widget.yearly"),
    principal: t("mcp.widget.principal"),
    interest: t("mcp.widget.interest"),
    extra: t("mcp.widget.extraPrincipal"),
  };
}

type TransactionOperationItem = {
  id?: string;
  title: string;
  amount: number;
  occurred_at: string;
  kind: string;
  status?: string;
  currency?: string | null;
  destination_currency?: string | null;
  note?: string | null;
  category_path?: string | null;
  category_name?: string | null;
  source_account_name?: string | null;
  destination_account_name?: string | null;
  destination_amount?: number | null;
  principal_amount?: number | null;
  interest_amount?: number | null;
  extra_principal_amount?: number | null;
};

type TransactionOperationSummary = {
  operation: string;
  status: "success";
  title: string;
  message: string;
  batchId?: string;
  transactionId?: string;
  itemId?: string;
  counts?: Record<string, number>;
  items?: TransactionOperationItem[];
};

const MCP_MUTATION_TOOLS = new Set([
  "submit_transaction_batch",
  "create_transactions",
  "create_transaction",
  "update_transaction",
  "delete_transaction",
  "update_transaction_draft",
  "delete_transaction_draft",
  "create_recurring_transaction_schedule",
  "create_recurring_transaction",
  "update_recurring_transaction_schedule",
  "update_recurring_transaction",
  "reschedule_recurring_transaction_series_from_occurrence",
  "reschedule_recurring_transaction",
  "update_recurring_transaction_occurrence",
  "update_recurring_occurrence",
  "mark_recurring_transaction_occurrence_paid",
  "mark_recurring_occurrence_paid",
  "delete_recurring_transaction_occurrence",
  "delete_recurring_occurrence",
  "skip_recurring_occurrence",
  "set_recurring_transaction_schedule_state",
  "set_recurring_transaction_state",
  "delete_recurring_transaction_schedule",
  "delete_recurring_transaction",
]);

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return new Response(null, {
      status: 401,
      headers: {
        ...CORS_HEADERS,
        "WWW-Authenticate": getMcpWwwAuthenticate(new URL(request.url).origin),
      },
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

interface RecurringScheduleItem {
  title?: unknown;
  note?: unknown;
  start_date?: unknown;
  frequency?: unknown;
  interval_weeks?: unknown;
  until_date?: unknown;
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
  purpose: Category["purpose"];
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

async function keyHasMutationEntitlement(keyHash: string) {
  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_key_has_mutation_entitlement", { p_key_hash: keyHash });
  return !error && data === true;
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
      capabilities: { tools: {}, resources: {} },
      serverInfo: { name: "moniq", version: "1.0.0" },
    },
  };
}

function directTransactionProperties() {
  return {
    title: { type: "string", title: "Title", description: "Merchant, payer, or concise transaction title." },
    note: { type: ["string", "null"], title: "Note", description: "Useful extra context, original label, or user-provided details." },
    occurred_at: { type: "string", title: "Date", description: "Transaction date in YYYY-MM-DD format." },
    status: { type: "string", title: "Status", enum: DIRECT_TRANSACTION_STATUSES, description: "Use paid for settled transactions and planned for upcoming ones." },
    kind: { type: "string", title: "Type", enum: TRANSACTION_KINDS },
    amount: { type: "number", title: "Amount", description: "Positive source-side amount." },
    destination_amount: { type: ["number", "null"], title: "Destination amount", description: "Transfer destination amount; omit/null to use amount." },
    fx_rate: { type: ["number", "null"], title: "FX rate", description: "Optional transfer FX rate." },
    principal_amount: { type: ["number", "null"], title: "Principal", description: "Debt payment principal component." },
    interest_amount: { type: ["number", "null"], title: "Interest", description: "Debt payment interest component." },
    extra_principal_amount: { type: ["number", "null"], title: "Extra principal", description: "Debt payment extra principal component." },
    category_id: { type: ["string", "null"], title: "Category", description: "Required selectable category ID for income/expense. Optional expense category for debt payment interest. Never set for transfers. In user-facing confirmation, describe this by category path from get_finance_context." },
    source_account_id: { type: ["string", "null"], title: "From wallet", description: "Required source wallet ID for expense, transfer, and debt payment. In user-facing confirmation, describe this by wallet name from get_finance_context." },
    destination_account_id: { type: ["string", "null"], title: "To wallet", description: "Required destination wallet ID for income, transfer, and debt payment. Debt payment destination must be a debt wallet. In user-facing confirmation, describe this by wallet name from get_finance_context." },
  };
}

function transactionOperationOutputSchema(title = "Moniq transaction result") {
  return {
    type: "object",
    title,
    additionalProperties: false,
    properties: {
      operation: { type: "string" },
      status: { type: "string", enum: ["success"] },
      title: { type: "string" },
      message: { type: "string" },
      batchId: { type: "string" },
      transactionId: { type: "string" },
      itemId: { type: "string" },
      counts: {
        type: "object",
        additionalProperties: { type: "number" },
      },
      items: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            amount: { type: "number" },
            occurred_at: { type: "string" },
            kind: { type: "string" },
            status: { type: "string" },
            currency: { type: ["string", "null"] },
            destination_currency: { type: ["string", "null"] },
            note: { type: ["string", "null"] },
            category_path: { type: ["string", "null"] },
            category_name: { type: ["string", "null"] },
            source_account_name: { type: ["string", "null"] },
            destination_account_name: { type: ["string", "null"] },
            destination_amount: { type: ["number", "null"] },
            principal_amount: { type: ["number", "null"] },
            interest_amount: { type: ["number", "null"] },
            extra_principal_amount: { type: ["number", "null"] },
          },
          required: ["title", "amount", "occurred_at", "kind"],
        },
      },
    },
    required: ["operation", "status", "title", "message"],
  };
}

function widgetOutputSchema(title: string) {
  return {
    type: "object",
    title,
    additionalProperties: true,
  };
}

function transactionWidgetMeta(invoking: string, invoked: string) {
  return moniqWidgetMeta(invoking, invoked);
}

function directTransactionInputSchema(title: string) {
  return {
    type: "object",
    title,
    properties: {
      transaction: {
        type: "object",
        title: "Transaction",
        required: ["title", "amount", "occurred_at", "status", "kind"],
        additionalProperties: false,
        properties: directTransactionProperties(),
      },
    },
    required: ["transaction"],
    additionalProperties: false,
  };
}

function recurringScheduleProperties() {
  return {
    type: "object",
    title: "Recurring transaction",
    required: ["title", "amount", "start_date", "frequency", "kind"],
    additionalProperties: false,
    properties: {
      title: { type: "string", title: "Title", description: "Concise recurring transaction title." },
      note: { type: ["string", "null"], title: "Note" },
      start_date: { type: "string", title: "First occurrence date", description: "First scheduled occurrence in YYYY-MM-DD format." },
      frequency: { type: "string", title: "Repeat", enum: SCHEDULE_FREQUENCIES },
      interval_weeks: { type: "integer", title: "Weekly interval", minimum: 1, description: "For weekly schedules, repeat every N weeks. Omit or use 1 for every week. Non-weekly schedules always store 1." },
      until_date: { type: ["string", "null"], title: "End repeat", description: "Optional inclusive end date in YYYY-MM-DD format." },
      kind: { type: "string", title: "Type", enum: TRANSACTION_KINDS },
      amount: { type: "number", title: "Amount", description: "Positive source-side amount." },
      destination_amount: { type: ["number", "null"], title: "Destination amount" },
      fx_rate: { type: ["number", "null"], title: "FX rate" },
      principal_amount: { type: ["number", "null"], title: "Principal" },
      interest_amount: { type: ["number", "null"], title: "Interest" },
      extra_principal_amount: { type: ["number", "null"], title: "Extra principal" },
      category_id: { type: ["string", "null"], title: "Category" },
      source_account_id: { type: ["string", "null"], title: "From wallet" },
      destination_account_id: { type: ["string", "null"], title: "To wallet" },
    },
  };
}

function recurringScheduleInputSchema(title: string) {
  return {
    type: "object",
    title,
    properties: {
      schedule: recurringScheduleProperties(),
    },
    required: ["schedule"],
    additionalProperties: false,
  };
}

function recurringOccurrenceActionSchema({
  title,
  valueSchema,
}: {
  title: string;
  valueSchema?: Record<string, unknown>;
}) {
  return {
    type: "object",
    title,
    properties: {
      transaction_id: { type: ["string", "null"], title: "Transaction ID", description: "Materialized occurrence transaction ID." },
      schedule_id: { type: ["string", "null"], title: "Schedule ID", description: "Recurring schedule ID for generated occurrences." },
      occurrence_date: { type: ["string", "null"], title: "Occurrence date", description: "Generated occurrence date in YYYY-MM-DD format." },
      ...(valueSchema ? { values: valueSchema } : {}),
    },
    required: valueSchema ? ["values"] : [],
    additionalProperties: false,
  };
}

function recurringToolAliases() {
  return [
    {
      name: "list_recurring_transactions",
      title: "List recurring transactions",
      description: "Alias of get_recurring_transaction_schedules. Read active and paused Moniq recurring transaction schedules.",
      annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
      _meta: moniqWidgetMeta("Reading recurring transactions", "Recurring transactions ready"),
      outputSchema: widgetOutputSchema("Moniq recurring transactions"),
      inputSchema: {
        type: "object",
        title: "Recurring schedule filters",
        properties: {
          states: {
            type: "array",
            title: "States",
            items: { type: "string", enum: SCHEDULE_STATES },
          },
        },
        additionalProperties: false,
      },
    },
    {
      name: "create_recurring_transaction",
      title: "Create recurring transaction",
      description: "Alias of create_recurring_transaction_schedule. Create a recurring Moniq transaction series.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
      _meta: moniqWidgetMeta("Creating recurring transaction", "Recurring transaction created"),
      outputSchema: widgetOutputSchema("Created recurring transaction"),
      inputSchema: recurringScheduleInputSchema("Recurring transaction"),
    },
    {
      name: "update_recurring_transaction",
      title: "Update recurring transaction",
      description: "Alias of update_recurring_transaction_schedule. Replace a recurring transaction series template with a complete payload.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
      _meta: moniqWidgetMeta("Updating recurring transaction", "Recurring transaction updated"),
      outputSchema: widgetOutputSchema("Updated recurring transaction"),
      inputSchema: {
        type: "object",
        title: "Recurring transaction update",
        properties: {
          schedule_id: { type: "string", title: "Schedule ID" },
          schedule: recurringScheduleProperties(),
        },
        required: ["schedule_id", "schedule"],
        additionalProperties: false,
      },
    },
    {
      name: "set_recurring_transaction_state",
      title: "Pause or resume recurring transaction",
      description: "Alias of set_recurring_transaction_schedule_state. Set a recurring series state to active or paused.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
      _meta: moniqWidgetMeta("Changing recurring transaction state", "Recurring transaction state changed"),
      outputSchema: widgetOutputSchema("Recurring transaction state"),
      inputSchema: {
        type: "object",
        title: "Recurring transaction state",
        properties: {
          schedule_id: { type: "string", title: "Schedule ID" },
          state: { type: "string", title: "State", enum: SCHEDULE_STATES },
        },
        required: ["schedule_id", "state"],
        additionalProperties: false,
      },
    },
    {
      name: "delete_recurring_transaction",
      title: "Delete recurring transaction",
      description: "Alias of delete_recurring_transaction_schedule. Delete a recurring series while preserving paid historical occurrences.",
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: false },
      _meta: moniqWidgetMeta("Deleting recurring transaction", "Recurring transaction deleted"),
      outputSchema: widgetOutputSchema("Deleted recurring transaction"),
      inputSchema: {
        type: "object",
        title: "Recurring transaction to delete",
        properties: {
          schedule_id: { type: "string", title: "Schedule ID" },
        },
        required: ["schedule_id"],
        additionalProperties: false,
      },
    },
    {
      name: "reschedule_recurring_transaction",
      title: "Reschedule recurring transaction",
      description: "Alias of reschedule_recurring_transaction_series_from_occurrence. Shift this and following occurrences from a chosen occurrence date.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
      _meta: moniqWidgetMeta("Rescheduling recurring series", "Recurring series rescheduled"),
      outputSchema: widgetOutputSchema("Rescheduled recurring transaction"),
      inputSchema: {
        type: "object",
        title: "Recurring series reschedule",
        properties: {
          schedule_id: { type: "string", title: "Schedule ID" },
          from_occurrence_date: { type: "string", title: "From date", description: "Occurrence date to shift from, YYYY-MM-DD." },
          new_occurrence_date: { type: "string", title: "New date", description: "New date for that occurrence, YYYY-MM-DD." },
        },
        required: ["schedule_id", "from_occurrence_date", "new_occurrence_date"],
        additionalProperties: false,
      },
    },
    {
      name: "update_recurring_occurrence",
      title: "Update recurring occurrence",
      description: "Alias of update_recurring_transaction_occurrence. Update one materialized or generated recurring occurrence.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
      _meta: moniqWidgetMeta("Updating recurring occurrence", "Recurring occurrence updated"),
      outputSchema: widgetOutputSchema("Updated recurring occurrence"),
      inputSchema: recurringOccurrenceActionSchema({
        title: "Recurring occurrence update",
        valueSchema: {
          type: "object",
          title: "Occurrence values",
          required: ["title", "amount", "occurred_at", "status", "kind"],
          additionalProperties: false,
          properties: directTransactionProperties(),
        },
      }),
    },
    {
      name: "mark_recurring_occurrence_paid",
      title: "Mark recurring occurrence paid",
      description: "Alias of mark_recurring_transaction_occurrence_paid. Materialize a generated occurrence if needed, then mark it paid.",
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
      _meta: moniqWidgetMeta("Marking recurring occurrence paid", "Recurring occurrence marked paid"),
      outputSchema: widgetOutputSchema("Paid recurring occurrence"),
      inputSchema: recurringOccurrenceActionSchema({ title: "Recurring occurrence to pay" }),
    },
    {
      name: "skip_recurring_occurrence",
      title: "Skip recurring occurrence",
      description: "Mark one recurring occurrence skipped so it remains hidden and does not regenerate.",
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: false },
      _meta: moniqWidgetMeta("Skipping recurring occurrence", "Recurring occurrence skipped"),
      outputSchema: widgetOutputSchema("Skipped recurring occurrence"),
      inputSchema: recurringOccurrenceActionSchema({ title: "Recurring occurrence to skip" }),
    },
    {
      name: "delete_recurring_occurrence",
      title: "Delete recurring occurrence",
      description: "Alias of delete_recurring_transaction_occurrence. Mark one recurring occurrence skipped so it will not regenerate.",
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: false },
      _meta: moniqWidgetMeta("Deleting recurring occurrence", "Recurring occurrence deleted"),
      outputSchema: widgetOutputSchema("Deleted recurring occurrence"),
      inputSchema: recurringOccurrenceActionSchema({ title: "Recurring occurrence to delete" }),
    },
  ];
}

function getMcpTools() {
  return [
        {
          name: "get_finance_context",
          title: "Get Moniq finance context",
          description:
            "Read the user's Moniq wallet and category context before creating transactions. Use this first so you can choose exact wallet IDs and category IDs. Categories include hierarchical paths and selectable flags; use category IDs, never free-text category names. When explaining the next action to the user, summarize wallets and categories by their names and paths, not by raw UUIDs.",
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
          _meta: {
            "openai/toolInvocation/invoking": "Reading Moniq context",
            "openai/toolInvocation/invoked": "Moniq context ready",
          },
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: "get_card_and_debt_balances",
          title: "Get card and debt balances",
          description:
            "Quickly read current Moniq balances for card-like wallets and debts only. Use this when the user asks for card balances, credit card debt, loans, mortgages, or total debts. Debit cards are cash wallets with cash_kind=debit_card; credit cards and debt wallets include outstanding_amount so you do not have to infer sign conventions.",
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
          _meta: moniqWidgetMeta("Checking Moniq balances", "Moniq balances ready"),
          outputSchema: widgetOutputSchema("Moniq card and debt balances"),
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: "get_transactions",
          title: "Get Moniq transactions",
          description:
            "Read all Moniq transactions for an inclusive date range, including past paid transactions, planned/skipped entries, one-off future transactions, and generated recurring schedule occurrences. Use this for retrospective analytics and future cash-flow forecasting. Generated recurring occurrences are returned with source=schedule, is_generated=true, and stable synthetic IDs. When replying, use wallet and category names from the returned context instead of exposing raw UUIDs.",
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
          _meta: moniqWidgetMeta("Reading Moniq transactions", "Moniq transactions ready"),
          outputSchema: widgetOutputSchema("Moniq transactions"),
          inputSchema: {
            type: "object",
            title: "Transaction period",
            properties: {
              start_date: {
                type: "string",
                title: "Start date",
                description: "Inclusive period start date in YYYY-MM-DD format.",
              },
              end_date: {
                type: "string",
                title: "End date",
                description: "Inclusive period end date in YYYY-MM-DD format.",
              },
              statuses: {
                type: "array",
                title: "Statuses",
                items: { type: "string", enum: READ_TRANSACTION_STATUSES },
                description: "Optional statuses to include. Defaults to paid, planned, and skipped.",
              },
              kinds: {
                type: "array",
                title: "Transaction types",
                items: { type: "string", enum: TRANSACTION_KINDS },
                description: "Optional transaction kinds to include. Defaults to income, expense, transfer, and debt_payment.",
              },
              account_ids: {
                type: "array",
                title: "Wallets",
                items: { type: "string" },
                description: "Optional source or destination wallet IDs to include. In user-facing summaries, refer to these wallets by name when known.",
              },
              category_ids: {
                type: "array",
                title: "Categories",
                items: { type: "string" },
                description: "Optional category IDs to include. Transfers without categories are excluded when this filter is set. In user-facing summaries, refer to these categories by path when known.",
              },
              include_context: {
                type: "boolean",
                title: "Include wallet and category names",
                description: "When true, include matching account, category, and schedule context in the response.",
              },
            },
            required: ["start_date", "end_date"],
            additionalProperties: false,
          },
        },
        {
          name: "create_transactions",
          title: "Add ledger transactions to Moniq",
          description:
            "Add complete bookkeeping records to the user's private Moniq ledger after every required field is confirmed. This records financial history only: it does not transfer money, charge a card, contact a bank, or initiate any external payment. Call get_finance_context first, use exact wallet/category IDs, and confirm dates, titles, amounts with currencies, wallet names, and category names in plain language. Never expose raw UUIDs unless the user explicitly requests technical details.",
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
          _meta: transactionWidgetMeta("Adding records to Moniq", "Moniq records added"),
          outputSchema: transactionOperationOutputSchema("Created transactions"),
          inputSchema: {
            type: "object",
            title: "Transactions to add",
            properties: {
              transactions: {
                type: "array",
                minItems: 1,
                title: "Transactions",
                description: "Complete transactions to create directly in Moniq. The confirmation shown to the user should describe these by merchant, date, amount, wallet name, and category name.",
                items: {
                  type: "object",
                  title: "Transaction",
                  required: ["title", "amount", "occurred_at", "status", "kind"],
                  additionalProperties: false,
                  properties: {
                    title: { type: "string", title: "Title", description: "Merchant, payer, or concise transaction title." },
                    note: { type: ["string", "null"], title: "Note", description: "Useful extra context, original label, or user-provided details." },
                    occurred_at: { type: "string", title: "Date", description: "Transaction date in YYYY-MM-DD format." },
                    status: { type: "string", title: "Status", enum: DIRECT_TRANSACTION_STATUSES, description: "Use paid for settled transactions and planned for upcoming ones." },
                    kind: { type: "string", title: "Type", enum: TRANSACTION_KINDS },
                    amount: { type: "number", title: "Amount", description: "Positive source-side amount." },
                    destination_amount: { type: ["number", "null"], title: "Destination amount", description: "Transfer destination amount; omit/null to use amount." },
                    fx_rate: { type: ["number", "null"], title: "FX rate", description: "Optional transfer FX rate." },
                    principal_amount: { type: ["number", "null"], title: "Principal", description: "Debt payment principal component." },
                    interest_amount: { type: ["number", "null"], title: "Interest", description: "Debt payment interest component." },
                    extra_principal_amount: { type: ["number", "null"], title: "Extra principal", description: "Debt payment extra principal component." },
                    category_id: { type: ["string", "null"], title: "Category", description: "Required selectable category ID for income/expense. Optional expense category for debt payment interest. Never set for transfers. In user-facing confirmation, describe this by category path from get_finance_context." },
                    source_account_id: { type: ["string", "null"], title: "From wallet", description: "Required source wallet ID for expense, transfer, and debt payment. In user-facing confirmation, describe this by wallet name from get_finance_context." },
                    destination_account_id: { type: ["string", "null"], title: "To wallet", description: "Required destination wallet ID for income, transfer, and debt payment. Debt payment destination must be a debt wallet. In user-facing confirmation, describe this by wallet name from get_finance_context." },
                  },
                },
              },
            },
            required: ["transactions"],
            additionalProperties: false,
          },
        },
        {
          name: "update_transaction",
          title: "Update Moniq transaction",
          description:
            "Replace one existing Moniq ledger transaction with a complete updated payload. Read the transaction first with get_transactions, confirm the change in plain language, and use exact wallet/category IDs.",
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
          _meta: transactionWidgetMeta("Updating transaction", "Transaction updated"),
          outputSchema: transactionOperationOutputSchema("Updated transaction"),
          inputSchema: {
            type: "object",
            title: "Transaction update",
            properties: {
              transaction_id: { type: "string", title: "Transaction ID" },
              transaction: directTransactionInputSchema("Transaction").properties.transaction,
            },
            required: ["transaction_id", "transaction"],
            additionalProperties: false,
          },
        },
        {
          name: "delete_transaction",
          title: "Delete Moniq transaction",
          description:
            "Delete one existing Moniq ledger transaction. Use only after confirming the exact transaction with the user.",
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: false },
          _meta: transactionWidgetMeta("Deleting transaction", "Transaction deleted"),
          outputSchema: transactionOperationOutputSchema("Deleted transaction"),
          inputSchema: {
            type: "object",
            title: "Transaction to delete",
            properties: {
              transaction_id: { type: "string", title: "Transaction ID" },
            },
            required: ["transaction_id"],
            additionalProperties: false,
          },
        },
        {
          name: "get_recurring_transaction_schedules",
          title: "Get recurring transactions",
          description:
            "Read Moniq recurring transaction schedules. Use this before editing, pausing, deleting, or explaining recurring payments. Include active and paused series unless the user asks for only one state.",
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
          _meta: moniqWidgetMeta("Reading recurring transactions", "Recurring transactions ready"),
          outputSchema: widgetOutputSchema("Moniq recurring transactions"),
          inputSchema: {
            type: "object",
            title: "Recurring schedule filters",
            properties: {
              states: {
                type: "array",
                title: "States",
                items: { type: "string", enum: SCHEDULE_STATES },
                description: "Optional schedule states to include. Defaults to active and paused.",
              },
            },
            additionalProperties: false,
          },
        },
        {
          name: "create_recurring_transaction_schedule",
          title: "Create recurring transaction",
          description:
            "Create a recurring Moniq transaction series. The start date is the first occurrence date. Call get_finance_context first and confirm amount, cadence, wallet names, category names, and start date with the user.",
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
          _meta: moniqWidgetMeta("Creating recurring transaction", "Recurring transaction created"),
          outputSchema: widgetOutputSchema("Created recurring transaction"),
          inputSchema: recurringScheduleInputSchema("Recurring transaction"),
        },
        {
          name: "update_recurring_transaction_schedule",
          title: "Update recurring transaction",
          description:
            "Replace a recurring transaction series template after reading it first. Submit the complete updated schedule payload, not a partial patch.",
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
          _meta: moniqWidgetMeta("Updating recurring transaction", "Recurring transaction updated"),
          outputSchema: widgetOutputSchema("Updated recurring transaction"),
          inputSchema: {
            type: "object",
            title: "Recurring transaction update",
            properties: {
              schedule_id: { type: "string", title: "Schedule ID" },
              schedule: recurringScheduleProperties(),
            },
            required: ["schedule_id", "schedule"],
            additionalProperties: false,
          },
        },
        {
          name: "reschedule_recurring_transaction_series_from_occurrence",
          title: "Reschedule recurring series",
          description:
            "Shift a recurring series from a specific occurrence onward by moving that occurrence to a new date. Use when the user wants this and following occurrences moved.",
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
          _meta: moniqWidgetMeta("Rescheduling recurring series", "Recurring series rescheduled"),
          outputSchema: widgetOutputSchema("Rescheduled recurring transaction"),
          inputSchema: {
            type: "object",
            title: "Recurring series reschedule",
            properties: {
              schedule_id: { type: "string", title: "Schedule ID" },
              from_occurrence_date: { type: "string", title: "From date", description: "Occurrence date to shift from, YYYY-MM-DD." },
              new_occurrence_date: { type: "string", title: "New date", description: "New date for that occurrence, YYYY-MM-DD." },
            },
            required: ["schedule_id", "from_occurrence_date", "new_occurrence_date"],
            additionalProperties: false,
          },
        },
        {
          name: "update_recurring_transaction_occurrence",
          title: "Update recurring occurrence",
          description:
            "Update one occurrence of a recurring transaction. Use transaction_id for a materialized occurrence, or schedule_id plus occurrence_date for a generated occurrence.",
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
          _meta: moniqWidgetMeta("Updating recurring occurrence", "Recurring occurrence updated"),
          outputSchema: widgetOutputSchema("Updated recurring occurrence"),
          inputSchema: recurringOccurrenceActionSchema({
            title: "Recurring occurrence update",
            valueSchema: {
              type: "object",
              title: "Occurrence values",
              required: ["title", "amount", "occurred_at", "status", "kind"],
              additionalProperties: false,
              properties: directTransactionProperties(),
            },
          }),
        },
        {
          name: "mark_recurring_transaction_occurrence_paid",
          title: "Mark recurring occurrence paid",
          description:
            "Mark one recurring occurrence as paid. Generated occurrences are materialized before being marked paid.",
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
          _meta: moniqWidgetMeta("Marking recurring occurrence paid", "Recurring occurrence marked paid"),
          outputSchema: widgetOutputSchema("Paid recurring occurrence"),
          inputSchema: recurringOccurrenceActionSchema({ title: "Recurring occurrence to pay" }),
        },
        {
          name: "delete_recurring_transaction_occurrence",
          title: "Delete recurring occurrence",
          description:
            "Delete one recurring occurrence by marking it skipped so it will not regenerate. Use for a single missed/cancelled occurrence, not the whole series.",
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: false },
          _meta: moniqWidgetMeta("Deleting recurring occurrence", "Recurring occurrence deleted"),
          outputSchema: widgetOutputSchema("Deleted recurring occurrence"),
          inputSchema: recurringOccurrenceActionSchema({ title: "Recurring occurrence to delete" }),
        },
        {
          name: "set_recurring_transaction_schedule_state",
          title: "Pause or resume recurring transaction",
          description:
            "Set a recurring transaction series state to active or paused. Paused series keep existing history and stop future generation.",
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
          _meta: moniqWidgetMeta("Changing recurring transaction state", "Recurring transaction state changed"),
          outputSchema: widgetOutputSchema("Recurring transaction state"),
          inputSchema: {
            type: "object",
            title: "Recurring transaction state",
            properties: {
              schedule_id: { type: "string", title: "Schedule ID" },
              state: { type: "string", title: "State", enum: SCHEDULE_STATES },
            },
            required: ["schedule_id", "state"],
            additionalProperties: false,
          },
        },
        {
          name: "delete_recurring_transaction_schedule",
          title: "Delete recurring transaction",
          description:
            "Delete a recurring transaction series. Paid historical occurrences are preserved; future non-paid planned occurrences are removed.",
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: false },
          _meta: moniqWidgetMeta("Deleting recurring transaction", "Recurring transaction deleted"),
          outputSchema: widgetOutputSchema("Deleted recurring transaction"),
          inputSchema: {
            type: "object",
            title: "Recurring transaction to delete",
            properties: {
              schedule_id: { type: "string", title: "Schedule ID" },
            },
            required: ["schedule_id"],
            additionalProperties: false,
          },
        },
        ...recurringToolAliases(),
        {
          name: "create_savings_goal",
          title: "Create savings goal",
          description:
            "Create a new savings goal (allocation) under a savings wallet. Confirm details (amount, name, target_amount, wallet_id) with the user before calling. wallet_id must be a savings wallet.",
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
          inputSchema: {
            type: "object",
            title: "Savings goal properties",
            required: ["wallet_id", "name", "kind", "amount"],
            additionalProperties: false,
            properties: {
              wallet_id: { type: "string", title: "Wallet ID", description: "The savings wallet ID." },
              name: { type: "string", title: "Goal Name", description: "Title or name of the savings goal." },
              kind: { type: "string", title: "Kind", enum: ["goal_open", "goal_targeted"], description: "Goal kind: goal_open (no specific target) or goal_targeted (requires target_amount)." },
              amount: { type: "number", title: "Amount", description: "Currently allocated starting amount (>= 0)." },
              target_amount: { type: ["number", "null"], title: "Target Amount", description: "Targeted amount for targeted goals." },
            },
          },
        },
        {
          name: "update_savings_goal",
          title: "Update savings goal",
          description:
            "Update an existing savings goal's properties (amount, name, kind, target_amount). Always confirm details in plain language with the user first.",
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
          inputSchema: {
            type: "object",
            title: "Savings goal update properties",
            required: ["goal_id", "name", "kind", "amount"],
            additionalProperties: false,
            properties: {
              goal_id: { type: "string", title: "Goal ID", description: "The savings goal (allocation) ID to update." },
              name: { type: "string", title: "Goal Name", description: "Title or name of the savings goal." },
              kind: { type: "string", title: "Kind", enum: ["goal_open", "goal_targeted"], description: "Goal kind: goal_open or goal_targeted." },
              amount: { type: "number", title: "Amount", description: "Allocated amount (>= 0)." },
              target_amount: { type: ["number", "null"], title: "Target Amount", description: "Targeted amount." },
            },
          },
        },
        {
          name: "delete_savings_goal",
          title: "Delete savings goal",
          description:
            "Delete an existing savings goal. Only use after explicit user confirmation.",
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: false },
          inputSchema: {
            type: "object",
            title: "Savings goal delete properties",
            required: ["goal_id"],
            additionalProperties: false,
            properties: {
              goal_id: { type: "string", title: "Goal ID", description: "The savings goal ID to delete." },
            },
          },
        },
        {
          name: "list_transaction_batches",
          title: "List Moniq Inbox batches",
          description:
            "List Moniq MCP transaction batches so you can recover batch IDs and continue create/edit/delete work in the same session.",
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
          _meta: {
            "openai/toolInvocation/invoking": "Reading inbox batches",
            "openai/toolInvocation/invoked": "Inbox batches ready",
          },
          inputSchema: {
            type: "object",
            title: "Batch filters",
            properties: {
              status: { type: ["string", "null"], enum: ["pending", "approved", "rejected", null], title: "Batch status" },
            },
            additionalProperties: false,
          },
        },
        {
          name: "get_transaction_batch",
          title: "Get Moniq Inbox batch",
          description:
            "Read a Moniq MCP transaction batch with its draft items before editing, rejecting, or deleting those draft records.",
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
          _meta: {
            "openai/toolInvocation/invoking": "Reading inbox batch",
            "openai/toolInvocation/invoked": "Inbox batch ready",
          },
          inputSchema: {
            type: "object",
            title: "Batch to read",
            properties: {
              batch_id: { type: "string", title: "Batch ID" },
            },
            required: ["batch_id"],
            additionalProperties: false,
          },
        },
        {
          name: "update_transaction_draft",
          title: "Update Moniq Inbox draft",
          description:
            "Update one pending transaction draft inside a Moniq MCP batch. Use this when the agent created an inbox draft incorrectly and should fix it before review.",
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
          _meta: transactionWidgetMeta("Updating draft", "Draft updated"),
          outputSchema: transactionOperationOutputSchema("Updated draft transaction"),
          inputSchema: {
            type: "object",
            title: "Draft update",
            properties: {
              batch_id: { type: "string", title: "Batch ID" },
              item_id: { type: "string", title: "Draft item ID" },
              patch: {
                type: "object",
                title: "Draft patch",
                additionalProperties: false,
                properties: {
                  title: { type: "string" },
                  amount: { type: "number" },
                  occurred_at: { type: "string" },
                  kind: { type: "string", enum: TRANSACTION_KINDS },
                  currency: { type: ["string", "null"] },
                  note: { type: ["string", "null"] },
                  suggested_category_name: { type: ["string", "null"] },
                  status: { type: "string", enum: ["pending", "approved", "rejected"] },
                  resolved_category_id: { type: ["string", "null"] },
                  resolved_account_id: { type: ["string", "null"] },
                  resolved_destination_account_id: { type: ["string", "null"] },
                },
              },
            },
            required: ["batch_id", "item_id", "patch"],
            additionalProperties: false,
          },
        },
        {
          name: "delete_transaction_draft",
          title: "Delete Moniq Inbox draft",
          description:
            "Remove one pending transaction draft from a Moniq MCP batch. Defaults to a soft delete by marking the item rejected; use hard_delete only when the row should disappear.",
          annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false, idempotentHint: false },
          _meta: transactionWidgetMeta("Deleting draft", "Draft deleted"),
          outputSchema: transactionOperationOutputSchema("Deleted draft transaction"),
          inputSchema: {
            type: "object",
            title: "Draft to delete",
            properties: {
              batch_id: { type: "string", title: "Batch ID" },
              item_id: { type: "string", title: "Draft item ID" },
              mode: { type: "string", enum: ["reject", "hard_delete"], title: "Delete mode", description: "Defaults to reject." },
            },
            required: ["batch_id", "item_id"],
            additionalProperties: false,
          },
        },
        {
          name: "submit_transaction_batch",
          title: "Send transactions to Moniq Inbox",
          description:
            "Legacy review flow: submit a batch of transactions extracted from a bank screenshot, statement, or file for review inside Moniq. Use this when confidence is low or the user explicitly wants inbox approval instead of direct ledger writes.",
          annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false, idempotentHint: false },
          _meta: transactionWidgetMeta("Sending to Moniq Inbox", "Sent to Moniq Inbox"),
          outputSchema: transactionOperationOutputSchema("Submitted transaction batch"),
          inputSchema: {
            type: "object",
            title: "Transactions for review",
            properties: {
              transactions: {
                type: "array",
                title: "Transactions",
                description: "List of transactions to submit for review.",
                items: {
                  type: "object",
                  title: "Transaction",
                  required: ["title", "amount", "occurred_at", "kind"],
                  additionalProperties: false,
                  properties: {
                    title: {
                      type: "string",
                      title: "Title",
                      description: "Merchant name or transaction description.",
                    },
                    amount: {
                      type: "number",
                      title: "Amount",
                      description: "Absolute transaction amount (always positive).",
                    },
                    occurred_at: {
                      type: "string",
                      title: "Date",
                      description: "Transaction date in YYYY-MM-DD format.",
                    },
                    kind: {
                      type: "string",
                      title: "Type",
                      enum: ["income", "expense"],
                      description: "Whether this is income or an expense.",
                    },
                    suggested_category_name: {
                      type: "string",
                      title: "Suggested category",
                      description:
                        "Your best guess at a category name (e.g. 'Groceries', 'Transport', 'Salary'). The user can override it during review.",
                    },
                    currency: {
                      type: "string",
                      title: "Currency",
                      description: "3-letter ISO currency code (e.g. EUR, USD, RUB). Optional.",
                    },
                    note: {
                      type: "string",
                      title: "Note",
                      description: "Any extra context or original bank label. Optional.",
                    },
                  },
                },
                minItems: 1,
              },
              source_description: {
                type: "string",
                title: "Source",
                description:
                  "Brief description of where these transactions came from (e.g. 'Tinkoff screenshot March 2025', 'Revolut CSV export').",
              },
            },
            required: ["transactions"],
          },
        },
        {
          name: "get_category_spending_report",
          title: "Get category spending report",
          description:
            "Read Moniq category spending analytics for a period. Defaults to the last fully completed calendar month. Returns paid transactions grouped by root expense envelopes and income categories, with totals and percentages separated by currency.",
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
          _meta: moniqWidgetMeta("Building spending report", "Spending report ready"),
          outputSchema: widgetOutputSchema("Moniq category spending report"),
          inputSchema: {
            type: "object",
            title: "Spending report period",
            properties: {
              period_preset: {
                type: "string",
                title: "Preset period",
                enum: ["last_complete_month"],
                description:
                  "Optional preset. Use last_complete_month to report the last fully completed calendar month.",
              },
              month: {
                type: "string",
                title: "Month",
                description: "Calendar month in YYYY-MM format. Mutually exclusive with start_date/end_date.",
              },
              start_date: {
                type: "string",
                title: "Start date",
                description: "Inclusive custom period start date in YYYY-MM-DD format.",
              },
              end_date: {
                type: "string",
                title: "End date",
                description: "Inclusive custom period end date in YYYY-MM-DD format.",
              },
            },
            additionalProperties: false,
          },
        },
        {
          name: "get_budget_month_analysis",
          title: "Get budget month analysis",
          description:
            "Read Moniq monthly budget analytics for a period. Defaults to the last fully completed calendar month. Returns paid income and expenses by currency, root envelopes, category tree, percentages, uncategorized groups, and transaction detail.",
          annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false },
          _meta: moniqWidgetMeta("Building month analysis", "Month analysis ready"),
          outputSchema: widgetOutputSchema("Moniq budget month analysis"),
          inputSchema: {
            type: "object",
            title: "Budget month analysis period",
            properties: {
              period_preset: {
                type: "string",
                title: "Preset period",
                enum: ["last_complete_month"],
                description:
                  "Optional preset. Use last_complete_month to report the last fully completed calendar month.",
              },
              month: {
                type: "string",
                title: "Month",
                description: "Calendar month in YYYY-MM format. Mutually exclusive with start_date/end_date.",
              },
              start_date: {
                type: "string",
                title: "Start date",
                description: "Inclusive custom period start date in YYYY-MM-DD format.",
              },
              end_date: {
                type: "string",
                title: "End date",
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
    purpose: row.purpose ?? null,
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
  t: McpTranslator,
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
      error: { code: -32602, message: error instanceof Error ? error.message : t("mcp.errors.invalidSpendingReportPeriod") },
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
      error: { code: -32000, message: t("mcp.errors.spendingReportLoadFailed") },
    };
  }

  const source = data as {
    wallets?: WalletRow[];
    categories?: CategoryRow[];
    transactions?: TransactionRow[];
  };
  const accounts = (source.wallets ?? []).map(mapWallet);
  const categories = (source.categories ?? []).map(mapCategory).filter((c) => !c.is_system);
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const transactions = (source.transactions ?? [])
    .map((transaction) => mapTransaction(transaction, { accountsById, categoriesById }))
    .filter((transaction) => !transaction.category_id || categoriesById.has(transaction.category_id));

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
      error: { code: -32602, message: error instanceof Error ? error.message : t("mcp.errors.invalidSpendingReportPeriod") },
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
  t: McpTranslator,
): Promise<McpResponse> {
  const startDate = getOptionalStringArg(args, "start_date");
  const endDate = getOptionalStringArg(args, "end_date");

  if (!isIsoDate(startDate) || !isIsoDate(endDate)) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: t("mcp.errors.transactionRangeRequired") },
    };
  }

  if (startDate > endDate) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: t("mcp.errors.startDateBeforeEndDate") },
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
      error: { code: -32602, message: t("mcp.errors.invalidReadStatuses") },
    };
  }

  if (kinds === null || kinds?.some((kind) => !TRANSACTION_KINDS.includes(kind as TransactionKind))) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32602, message: t("mcp.errors.invalidKinds") },
    };
  }

  if (accountIds === null) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.accountIdsArray") } };
  }

  if (categoryIds === null) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.categoryIdsArray") } };
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
      error: { code: -32000, message: error?.message ?? t("mcp.errors.transactionsLoadFailed") },
    };
  }

  let widgetData = data;
  if (isRecord(data) && Array.isArray(data.transactions)) {
    const { data: contextData } = await db.rpc("mcp_get_finance_context", { p_key_hash: keyHash });
    if (contextData) {
      const context = sanitizeFinanceContext(contextData);
      const wallets = new Map(context.wallets.map((wallet) => [String(wallet.id), wallet]));
      const categories = new Map(context.categories.map((category) => [String(category.id), category]));
      widgetData = {
        ...data,
        transactions: data.transactions
          .filter((entry) => {
            if (!isRecord(entry)) return false;
            if (entry.category_id && !categories.has(String(entry.category_id))) {
              return false;
            }
            return true;
          })
          .map((entry) => {
            if (!isRecord(entry)) return entry;
            const source = wallets.get(String(entry.source_account_id ?? ""));
            const destination = wallets.get(String(entry.destination_account_id ?? ""));
            const category = categories.get(String(entry.category_id ?? ""));
            return {
              ...entry,
              source_account_name: entry.source_account_name ?? source?.name ?? null,
              destination_account_name: entry.destination_account_name ?? destination?.name ?? null,
              category_name: entry.category_name ?? category?.name ?? null,
              category_path: category?.path ?? entry.category_name ?? null,
              currency: entry.currency ?? source?.currency ?? destination?.currency ?? null,
              destination_currency: destination?.currency ?? null,
            };
          }),
      };
    }
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify(widgetData, null, 2),
        },
      ],
      structuredContent: widgetData,
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

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 1;
}

function isKind(value: unknown): value is TransactionKind {
  return typeof value === "string" && TRANSACTION_KINDS.includes(value as TransactionKind);
}

function isStatus(value: unknown): value is DirectTransactionStatus {
  return typeof value === "string" && DIRECT_TRANSACTION_STATUSES.includes(value as DirectTransactionStatus);
}

function isScheduleFrequency(value: unknown): value is ScheduleFrequency {
  return typeof value === "string" && SCHEDULE_FREQUENCIES.includes(value as ScheduleFrequency);
}

function isScheduleState(value: unknown): value is ScheduleState {
  return typeof value === "string" && SCHEDULE_STATES.includes(value as ScheduleState);
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

function validateRecurringSchedule(schedule: unknown, labelPrefix = "Recurring transaction"): string | null {
  if (!isRecord(schedule)) return `${labelPrefix} schedule must be an object`;

  const label = typeof schedule.title === "string" && schedule.title.trim() ? schedule.title.trim() : "recurring transaction";

  if (!schedule.title || typeof schedule.title !== "string" || !schedule.title.trim()) return `${labelPrefix} must have a title`;
  if (!isPositiveNumber(schedule.amount)) return `${labelPrefix} "${label}" must have a positive amount`;
  if (!isIsoDate(schedule.start_date)) return `${labelPrefix} "${label}" must have start_date in YYYY-MM-DD format`;
  if (!isScheduleFrequency(schedule.frequency)) return `${labelPrefix} "${label}" frequency must be daily, weekly, monthly, or yearly`;
  if (schedule.interval_weeks != null && !isPositiveInteger(schedule.interval_weeks)) {
    return `${labelPrefix} "${label}" interval_weeks must be an integer greater than or equal to 1`;
  }
  if (schedule.until_date != null && !isIsoDate(schedule.until_date)) return `${labelPrefix} "${label}" until_date must be null or YYYY-MM-DD`;
  if (typeof schedule.until_date === "string" && typeof schedule.start_date === "string" && schedule.until_date < schedule.start_date) {
    return `${labelPrefix} "${label}" until_date must be on or after start_date`;
  }
  if (!isKind(schedule.kind)) return `${labelPrefix} "${label}" kind must be one of income, expense, transfer, debt_payment`;
  if (schedule.note != null && typeof schedule.note !== "string") return `${labelPrefix} "${label}" note must be a string or null`;

  if (schedule.destination_amount != null && !isPositiveNumber(schedule.destination_amount)) {
    return `${labelPrefix} "${label}" destination_amount must be positive when provided`;
  }
  if (schedule.fx_rate != null && !isPositiveNumber(schedule.fx_rate)) {
    return `${labelPrefix} "${label}" fx_rate must be positive when provided`;
  }

  if (schedule.kind === "income") {
    if (!optionalString(schedule.destination_account_id)) return `${labelPrefix} "${label}" income must include destination_account_id`;
    if (!optionalString(schedule.category_id)) return `${labelPrefix} "${label}" income must include category_id`;
    if (optionalString(schedule.source_account_id)) return `${labelPrefix} "${label}" income must not include source_account_id`;
  }

  if (schedule.kind === "expense") {
    if (!optionalString(schedule.source_account_id)) return `${labelPrefix} "${label}" expense must include source_account_id`;
    if (!optionalString(schedule.category_id)) return `${labelPrefix} "${label}" expense must include category_id`;
    if (optionalString(schedule.destination_account_id)) return `${labelPrefix} "${label}" expense must not include destination_account_id`;
  }

  if (schedule.kind === "transfer") {
    if (!optionalString(schedule.source_account_id)) return `${labelPrefix} "${label}" transfer must include source_account_id`;
    if (!optionalString(schedule.destination_account_id)) return `${labelPrefix} "${label}" transfer must include destination_account_id`;
    if (optionalString(schedule.category_id)) return `${labelPrefix} "${label}" transfer must not include category_id`;
  }

  if (schedule.kind === "debt_payment") {
    if (!optionalString(schedule.source_account_id)) return `${labelPrefix} "${label}" debt_payment must include source_account_id`;
    if (!optionalString(schedule.destination_account_id)) return `${labelPrefix} "${label}" debt_payment must include destination_account_id`;

    const principal = schedule.principal_amount ?? 0;
    const interest = schedule.interest_amount ?? 0;
    const extra = schedule.extra_principal_amount ?? 0;
    if (!isNonNegativeNumber(principal) || !isNonNegativeNumber(interest) || !isNonNegativeNumber(extra)) {
      return `${labelPrefix} "${label}" debt payment breakdown values must be non-negative`;
    }
    if (principal + interest + extra <= 0) {
      return `${labelPrefix} "${label}" debt_payment must include at least one breakdown amount`;
    }
    if (Math.abs(principal + interest + extra - schedule.amount) > 0.01) {
      return `${labelPrefix} "${label}" amount must equal principal_amount + interest_amount + extra_principal_amount`;
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

function normalizeRecurringSchedule(schedule: RecurringScheduleItem) {
  return {
    title: (schedule.title as string).trim(),
    note: optionalString(schedule.note),
    start_date: schedule.start_date,
    frequency: schedule.frequency,
    interval_weeks: schedule.frequency === "weekly" ? schedule.interval_weeks ?? 1 : 1,
    until_date: optionalString(schedule.until_date),
    kind: schedule.kind,
    amount: schedule.amount,
    destination_amount: schedule.kind === "transfer" ? schedule.destination_amount ?? null : null,
    fx_rate: schedule.kind === "transfer" ? schedule.fx_rate ?? null : null,
    principal_amount: schedule.kind === "debt_payment" ? schedule.principal_amount ?? 0 : null,
    interest_amount: schedule.kind === "debt_payment" ? schedule.interest_amount ?? 0 : null,
    extra_principal_amount: schedule.kind === "debt_payment" ? schedule.extra_principal_amount ?? 0 : null,
    category_id: schedule.kind === "transfer" ? null : optionalString(schedule.category_id),
    source_account_id: schedule.kind === "income" ? null : optionalString(schedule.source_account_id),
    destination_account_id: schedule.kind === "expense" ? null : optionalString(schedule.destination_account_id),
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

function sanitizeFinanceContext(data: unknown) {
  const source = isRecord(data) ? data : {};
  const wallets = Array.isArray(source.wallets) ? source.wallets : [];
  const categories = Array.isArray(source.categories) ? source.categories : [];
  const goals = Array.isArray(source.goals) ? source.goals : [];

  return {
    wallets: wallets.filter(isRecord).map((wallet) => ({
      id: wallet.id,
      name: wallet.name,
      type: wallet.type,
      cash_kind: wallet.cash_kind ?? null,
      debt_kind: wallet.debt_kind ?? null,
      currency: wallet.currency,
      balance: wallet.balance,
      credit_limit: wallet.credit_limit ?? null,
    })),
    categories: categories
      .filter(isRecord)
      .filter((category) => !category.is_system)
      .map((category) => ({
        id: category.id,
        type: category.type,
        name: category.name,
        path: category.path,
        parent_id: category.parent_id ?? null,
        icon: category.icon ?? null,
        is_system: category.is_system,
        is_selectable: category.is_selectable,
      })),
    goals: goals.filter(isRecord).map((goal) => ({
      id: goal.id,
      wallet_id: goal.wallet_id,
      name: goal.name,
      kind: goal.kind,
      amount: goal.amount,
      target_amount: goal.target_amount ?? null,
    })),
    rules: source.rules,
  };
}

async function handleGetFinanceContext(id: string | number | null, keyHash: string, t: McpTranslator): Promise<McpResponse> {
  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_get_finance_context", { p_key_hash: keyHash });

  if (error || !data) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message ?? t("mcp.errors.financeContextLoadFailed") },
    };
  }

  const context = sanitizeFinanceContext(data);

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: JSON.stringify(context, null, 2),
        },
      ],
      structuredContent: context,
    },
  };
}

async function handleGetCardAndDebtBalances(id: string | number | null, keyHash: string, t: McpTranslator): Promise<McpResponse> {
  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_get_finance_context", { p_key_hash: keyHash });

  if (error || !data) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message ?? t("mcp.errors.balancesLoadFailed") },
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

function getOccurrenceRef(args: Record<string, unknown>, t: McpTranslator): {
  transactionId: string | null;
  scheduleId: string | null;
  occurrenceDate: string | null;
  error: string | null;
} {
  const transactionId = optionalString(args.transaction_id);
  const scheduleId = optionalString(args.schedule_id);
  const occurrenceDate = optionalString(args.occurrence_date);

  if (transactionId && (scheduleId || occurrenceDate)) {
    return {
      transactionId: null,
      scheduleId: null,
      occurrenceDate: null,
      error: t("mcp.errors.occurrenceRefExclusive"),
    };
  }

  if (transactionId) {
    return { transactionId, scheduleId: null, occurrenceDate: null, error: null };
  }

  if (!scheduleId || !isIsoDate(occurrenceDate)) {
    return {
      transactionId: null,
      scheduleId: null,
      occurrenceDate: null,
      error: t("mcp.errors.occurrenceRefRequired"),
    };
  }

  return { transactionId: null, scheduleId, occurrenceDate, error: null };
}

function successResponse(id: string | number | null, text: string, data: unknown): McpResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text }],
      structuredContent: data,
    },
  };
}

function handleResourcesList(id: string | number | null): McpResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      resources: [
        {
          uri: MONIQ_WIDGET_URI,
          name: "moniq-finance-result",
          title: "Moniq finance result",
          description: "Shows compact, human-readable Moniq finance results.",
          mimeType: MONIQ_WIDGET_MIME_TYPE,
          _meta: MONIQ_WIDGET_RESOURCE_META,
        },
      ],
    },
  };
}

function handleResourcesRead(
  id: string | number | null,
  t: McpTranslator,
  params?: Record<string, unknown>,
): McpResponse {
  const uri = typeof params?.uri === "string" ? params.uri : "";
  if (uri !== MONIQ_WIDGET_URI) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: `Unknown resource: ${uri}` } };
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      contents: [
        {
          uri: MONIQ_WIDGET_URI,
          mimeType: MONIQ_WIDGET_MIME_TYPE,
          text: moniqWidgetHtml(getMoniqWidgetCopy(t)),
          _meta: MONIQ_WIDGET_RESOURCE_META,
        },
      ],
    },
  };
}

function transactionOperationResponse(
  id: string | number | null,
  summary: TransactionOperationSummary,
  privateDetails: unknown,
): McpResponse {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: summary.message }],
      structuredContent: summary,
      _meta: {
        operationResult: privateDetails,
      },
    },
  };
}

function summarizeTransactionItem(item: unknown): TransactionOperationItem | null {
  if (!isRecord(item)) return null;
  const title = typeof item.title === "string" ? item.title : null;
  const amount = typeof item.amount === "number" ? item.amount : Number(item.amount);
  const occurredAt = typeof item.occurred_at === "string" ? item.occurred_at : null;
  const kind = typeof item.kind === "string" ? item.kind : null;
  if (!title || !Number.isFinite(amount) || !occurredAt || !kind) return null;

  return {
    id: typeof item.id === "string" ? item.id : undefined,
    title,
    amount,
    occurred_at: occurredAt,
    kind,
    status: typeof item.status === "string" ? item.status : undefined,
    currency: typeof item.currency === "string" ? item.currency : item.currency === null ? null : undefined,
    destination_currency: typeof item.destination_currency === "string" ? item.destination_currency : item.destination_currency === null ? null : undefined,
    note: typeof item.note === "string" ? item.note : item.note === null ? null : undefined,
    category_path: typeof item.category_path === "string" ? item.category_path : item.category_path === null ? null : undefined,
    category_name: typeof item.category_name === "string" ? item.category_name : item.category_name === null ? null : undefined,
    source_account_name: typeof item.source_account_name === "string" ? item.source_account_name : item.source_account_name === null ? null : undefined,
    destination_account_name: typeof item.destination_account_name === "string" ? item.destination_account_name : item.destination_account_name === null ? null : undefined,
    destination_amount: typeof item.destination_amount === "number" ? item.destination_amount : item.destination_amount === null ? null : undefined,
    principal_amount: typeof item.principal_amount === "number" ? item.principal_amount : item.principal_amount === null ? null : undefined,
    interest_amount: typeof item.interest_amount === "number" ? item.interest_amount : item.interest_amount === null ? null : undefined,
    extra_principal_amount: typeof item.extra_principal_amount === "number" ? item.extra_principal_amount : item.extra_principal_amount === null ? null : undefined,
  };
}

async function loadTransactionWidgetItems(
  keyHash: string,
  ids: string[],
): Promise<TransactionOperationItem[]> {
  if (ids.length === 0) return [];

  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_get_transaction_widget_items", {
    p_key_hash: keyHash,
    p_transaction_ids: ids,
  });
  if (error || !Array.isArray(data)) return [];

  return data.map(summarizeTransactionItem).filter((item): item is TransactionOperationItem => item !== null);
}

async function callRecurringRpc(
  id: string | number | null,
  rpcName: string,
  payload: Record<string, unknown>,
  successText: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const db = createAnonClient();
  const { data, error } = await db.rpc(rpcName, payload);

  if (error || data == null) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message ?? t("mcp.errors.rpcCallFailed", { rpcName }) },
    };
  }

  const structuredContent = isRecord(data)
    ? { title: successText, message: successText, ...data }
    : { title: successText, message: successText, result: data };

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [{ type: "text", text: successText }],
      structuredContent,
    },
  };
}

async function handleGetRecurringSchedules(
  id: string | number | null,
  args: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const states = getOptionalStringArrayArg(args, "states");
  if (states === null || states?.some((state) => !isScheduleState(state))) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.invalidScheduleStates") } };
  }

  return callRecurringRpc(
    id,
    "mcp_get_recurring_transaction_schedules",
    { p_key_hash: keyHash, p_states: states ?? null },
    t("mcp.success.recurringLoaded"),
    t,
  );
}

async function handleCreateRecurringSchedule(
  id: string | number | null,
  params: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const args = (params.arguments ?? {}) as { schedule?: unknown };
  const validationError = validateRecurringSchedule(args.schedule);
  if (validationError) return { jsonrpc: "2.0", id, error: { code: -32602, message: validationError } };

  return callRecurringRpc(
    id,
    "mcp_create_recurring_transaction_schedule",
    { p_key_hash: keyHash, p_schedule: normalizeRecurringSchedule(args.schedule as RecurringScheduleItem) },
    t("mcp.success.recurringCreated"),
    t,
  );
}

async function handleUpdateRecurringSchedule(
  id: string | number | null,
  params: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const args = (params.arguments ?? {}) as { schedule_id?: unknown; schedule?: unknown };
  const scheduleId = optionalString(args.schedule_id);
  if (!scheduleId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.scheduleIdRequired") } };

  const validationError = validateRecurringSchedule(args.schedule);
  if (validationError) return { jsonrpc: "2.0", id, error: { code: -32602, message: validationError } };

  return callRecurringRpc(
    id,
    "mcp_update_recurring_transaction_schedule",
    { p_key_hash: keyHash, p_schedule_id: scheduleId, p_schedule: normalizeRecurringSchedule(args.schedule as RecurringScheduleItem) },
    t("mcp.success.recurringUpdated"),
    t,
  );
}

async function handleRescheduleRecurringSeries(
  id: string | number | null,
  args: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const scheduleId = optionalString(args.schedule_id);
  const fromOccurrenceDate = optionalString(args.from_occurrence_date);
  const newOccurrenceDate = optionalString(args.new_occurrence_date);

  if (!scheduleId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.scheduleIdRequired") } };
  if (!isIsoDate(fromOccurrenceDate) || !isIsoDate(newOccurrenceDate)) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.rescheduleDatesRequired") } };
  }

  return callRecurringRpc(
    id,
    "mcp_reschedule_recurring_transaction_series_from_occurrence",
    {
      p_key_hash: keyHash,
      p_schedule_id: scheduleId,
      p_from_occurrence_date: fromOccurrenceDate,
      p_new_occurrence_date: newOccurrenceDate,
    },
    t("mcp.success.recurringRescheduled"),
    t,
  );
}

async function handleUpdateRecurringOccurrence(
  id: string | number | null,
  params: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  const ref = getOccurrenceRef(args, t);
  if (ref.error) return { jsonrpc: "2.0", id, error: { code: -32602, message: ref.error } };

  const values = args.values;
  const validationError = validateDirectTransaction(values, 0);
  if (validationError) return { jsonrpc: "2.0", id, error: { code: -32602, message: validationError } };

  return callRecurringRpc(
    id,
    "mcp_update_recurring_transaction_occurrence",
    {
      p_key_hash: keyHash,
      p_transaction_id: ref.transactionId,
      p_schedule_id: ref.scheduleId,
      p_occurrence_date: ref.occurrenceDate,
      p_transaction: normalizeDirectTransaction(values as DirectTransactionItem),
    },
    t("mcp.success.occurrenceUpdated"),
    t,
  );
}

async function handleRecurringOccurrenceStatus(
  id: string | number | null,
  args: Record<string, unknown>,
  keyHash: string,
  status: "paid" | "skipped",
  t: McpTranslator,
): Promise<McpResponse> {
  const ref = getOccurrenceRef(args, t);
  if (ref.error) return { jsonrpc: "2.0", id, error: { code: -32602, message: ref.error } };

  return callRecurringRpc(
    id,
    "mcp_set_recurring_transaction_occurrence_status",
    {
      p_key_hash: keyHash,
      p_transaction_id: ref.transactionId,
      p_schedule_id: ref.scheduleId,
      p_occurrence_date: ref.occurrenceDate,
      p_status: status,
    },
    status === "paid" ? t("mcp.success.occurrencePaid") : t("mcp.success.occurrenceDeleted"),
    t,
  );
}

async function handleSetRecurringScheduleState(
  id: string | number | null,
  args: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const scheduleId = optionalString(args.schedule_id);
  if (!scheduleId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.scheduleIdRequired") } };
  if (!isScheduleState(args.state)) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.invalidScheduleState") } };

  return callRecurringRpc(
    id,
    "mcp_set_recurring_transaction_schedule_state",
    { p_key_hash: keyHash, p_schedule_id: scheduleId, p_state: args.state },
    t("mcp.success.recurringStateUpdated"),
    t,
  );
}

async function handleDeleteRecurringSchedule(
  id: string | number | null,
  args: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const scheduleId = optionalString(args.schedule_id);
  if (!scheduleId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.scheduleIdRequired") } };

  return callRecurringRpc(
    id,
    "mcp_delete_recurring_transaction_schedule",
    { p_key_hash: keyHash, p_schedule_id: scheduleId },
    t("mcp.success.recurringDeleted"),
    t,
  );
}

async function handleCreateTransactions(
  id: string | number | null,
  params: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const args = (params.arguments ?? {}) as { transactions?: unknown[] };
  const transactions = args.transactions;

  if (!Array.isArray(transactions) || transactions.length === 0) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.transactionsRequired") } };
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
      error: { code: -32000, message: error?.message ?? t("mcp.errors.createTransactionsFailed") },
    };
  }

  const created = Array.isArray(data) ? data.length : ((data as { created?: unknown[] }).created?.length ?? normalized.length);
  let createdItems = isRecord(data) && Array.isArray(data.created)
    ? data.created.map(summarizeTransactionItem).filter((item): item is TransactionOperationItem => item !== null)
    : [];
  const createdIds = createdItems.flatMap((item) => item.id ? [item.id] : []);
  const enrichedItems = await loadTransactionWidgetItems(keyHash, createdIds);
  if (enrichedItems.length === createdIds.length) createdItems = enrichedItems;

  return transactionOperationResponse(
    id,
    {
      operation: "create_transactions",
      status: "success",
      title: t("mcp.success.transactionsCreatedTitle"),
      message: t("mcp.success.transactionsCreated", { count: created }),
      counts: { created },
      items: createdItems,
    },
    data,
  );
}

async function handleCreateTransaction(
  id: string | number | null,
  params: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const args = (params.arguments ?? {}) as { transaction?: unknown };
  const validationError = validateDirectTransaction(args.transaction, 0);
  if (validationError) return { jsonrpc: "2.0", id, error: { code: -32602, message: validationError } };

  const response = await handleCreateTransactions(
    id,
    { arguments: { transactions: [args.transaction] } },
    keyHash,
    t,
  );
  if (isRecord(response.result) && isRecord(response.result.structuredContent)) {
    response.result.structuredContent.operation = "create_transaction";
    response.result.structuredContent.title = t("mcp.success.transactionCreatedTitle");
  }
  return response;
}

async function handleUpdateTransaction(
  id: string | number | null,
  params: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const args = (params.arguments ?? {}) as { transaction_id?: unknown; transaction?: unknown };
  const transactionId = optionalString(args.transaction_id);
  if (!transactionId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.transactionIdRequired") } };

  const validationError = validateDirectTransaction(args.transaction, 0);
  if (validationError) return { jsonrpc: "2.0", id, error: { code: -32602, message: validationError } };

  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_update_transaction", {
    p_key_hash: keyHash,
    p_transaction_id: transactionId,
    p_transaction: normalizeDirectTransaction(args.transaction as DirectTransactionItem),
  });

  if (error || !data) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message ?? t("mcp.errors.updateTransactionFailed") },
    };
  }

  const enriched = await loadTransactionWidgetItems(keyHash, [transactionId]);
  const updated = enriched[0] ?? (isRecord(data) ? summarizeTransactionItem(data.updated) : null);
  return transactionOperationResponse(
    id,
    {
      operation: "update_transaction",
      status: "success",
      title: t("mcp.success.transactionUpdatedTitle"),
      message: t("mcp.success.transactionUpdated"),
      transactionId,
      counts: { updated: 1 },
      items: updated ? [updated] : undefined,
    },
    data,
  );
}

async function handleDeleteTransaction(
  id: string | number | null,
  args: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const transactionId = optionalString(args.transaction_id);
  if (!transactionId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.transactionIdRequired") } };

  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_delete_transaction", {
    p_key_hash: keyHash,
    p_transaction_id: transactionId,
  });

  if (error || !data) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message ?? t("mcp.errors.deleteTransactionFailed") },
    };
  }

  const deleted = isRecord(data) ? summarizeTransactionItem(data.deleted) : null;
  return transactionOperationResponse(
    id,
    {
      operation: "delete_transaction",
      status: "success",
      title: t("mcp.success.transactionDeletedTitle"),
      message: t("mcp.success.transactionDeleted"),
      transactionId,
      counts: { deleted: 1 },
      items: deleted ? [deleted] : undefined,
    },
    data,
  );
}

async function handleCreateSavingsGoal(
  id: string | number | null,
  params: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  const walletId = optionalString(args.wallet_id);
  const name = optionalString(args.name);
  const kind = optionalString(args.kind);
  const amount = typeof args.amount === "number" ? args.amount : 0;
  const targetAmount = typeof args.target_amount === "number" ? args.target_amount : null;

  if (!walletId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.walletIdRequired") } };
  if (!name) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.goalNameRequired") } };
  if (kind !== "goal_open" && kind !== "goal_targeted") {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.goalKindInvalid") } };
  }

  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_create_wallet_allocation", {
    p_key_hash: keyHash,
    p_wallet_id: walletId,
    p_name: name,
    p_kind: kind,
    p_amount: amount,
    p_target_amount: targetAmount,
  });

  if (error || !data) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message ?? t("mcp.errors.createGoalFailed") },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: `Savings goal "${name}" created successfully.`,
        },
      ],
      goal: data,
    },
  };
}

async function handleUpdateSavingsGoal(
  id: string | number | null,
  params: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  const allocationId = optionalString(args.goal_id);
  const name = optionalString(args.name);
  const kind = optionalString(args.kind);
  const amount = typeof args.amount === "number" ? args.amount : 0;
  const targetAmount = typeof args.target_amount === "number" ? args.target_amount : null;

  if (!allocationId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.goalIdRequired") } };
  if (!name) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.goalNameRequired") } };
  if (kind !== "goal_open" && kind !== "goal_targeted") {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.goalKindInvalid") } };
  }

  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_update_wallet_allocation", {
    p_key_hash: keyHash,
    p_allocation_id: allocationId,
    p_name: name,
    p_kind: kind,
    p_amount: amount,
    p_target_amount: targetAmount,
  });

  if (error || !data) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message ?? t("mcp.errors.updateGoalFailed") },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: `Savings goal "${name}" updated successfully.`,
        },
      ],
      goal: data,
    },
  };
}

async function handleDeleteSavingsGoal(
  id: string | number | null,
  params: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const args = (params.arguments ?? {}) as Record<string, unknown>;
  const allocationId = optionalString(args.goal_id);

  if (!allocationId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.goalIdRequired") } };

  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_delete_wallet_allocation", {
    p_key_hash: keyHash,
    p_allocation_id: allocationId,
  });

  if (error || !data) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32000, message: error?.message ?? t("mcp.errors.deleteGoalFailed") },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: `Savings goal deleted successfully.`,
        },
      ],
      goal: data,
    },
  };
}

async function handleListTransactionBatches(
  id: string | number | null,
  args: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const status = optionalString(args.status);
  if (status && !["pending", "approved", "rejected"].includes(status)) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.invalidBatchStatus") } };
  }

  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_list_transaction_batches", {
    p_key_hash: keyHash,
    p_status: status ?? "pending",
  });

  if (error || !data) {
    return { jsonrpc: "2.0", id, error: { code: -32000, message: error?.message ?? t("mcp.errors.batchesLoadFailed") } };
  }

  return successResponse(id, t("mcp.success.batchesLoaded"), data);
}

async function handleGetTransactionBatch(
  id: string | number | null,
  args: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const batchId = optionalString(args.batch_id);
  if (!batchId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.batchIdRequired") } };

  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_get_transaction_batch", {
    p_key_hash: keyHash,
    p_batch_id: batchId,
  });

  if (error || !data) {
    return { jsonrpc: "2.0", id, error: { code: -32000, message: error?.message ?? t("mcp.errors.batchLoadFailed") } };
  }

  return successResponse(id, t("mcp.success.batchLoaded"), data);
}

async function handleUpdateTransactionDraft(
  id: string | number | null,
  args: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const batchId = optionalString(args.batch_id);
  const itemId = optionalString(args.item_id);
  if (!batchId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.batchIdRequired") } };
  if (!itemId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.itemIdRequired") } };
  if (!isRecord(args.patch)) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.patchRequired") } };

  if (args.patch.amount !== undefined && !isPositiveNumber(args.patch.amount)) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.patchAmountPositive") } };
  }
  if (args.patch.occurred_at !== undefined && !isIsoDate(args.patch.occurred_at)) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.patchDateRequired") } };
  }
  if (args.patch.kind !== undefined && !isKind(args.patch.kind)) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.invalidKinds") } };
  }
  if (
    args.patch.status !== undefined &&
    !["pending", "approved", "rejected"].includes(String(args.patch.status))
  ) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.invalidDraftStatus") } };
  }

  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_update_transaction_draft", {
    p_key_hash: keyHash,
    p_batch_id: batchId,
    p_item_id: itemId,
    p_patch: args.patch,
  });

  if (error || !data) {
    return { jsonrpc: "2.0", id, error: { code: -32000, message: error?.message ?? t("mcp.errors.updateDraftFailed") } };
  }

  const updated = isRecord(data) ? summarizeTransactionItem(data.updated) : null;
  return transactionOperationResponse(
    id,
    {
      operation: "update_transaction_draft",
      status: "success",
      title: t("mcp.success.draftUpdatedTitle"),
      message: t("mcp.success.draftUpdated"),
      batchId,
      itemId,
      counts: { updated: 1 },
      items: updated ? [updated] : undefined,
    },
    data,
  );
}

async function handleDeleteTransactionDraft(
  id: string | number | null,
  args: Record<string, unknown>,
  keyHash: string,
  t: McpTranslator,
): Promise<McpResponse> {
  const batchId = optionalString(args.batch_id);
  const itemId = optionalString(args.item_id);
  const mode = optionalString(args.mode) ?? "reject";
  if (!batchId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.batchIdRequired") } };
  if (!itemId) return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.itemIdRequired") } };
  if (!["reject", "hard_delete"].includes(mode)) {
    return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.invalidDraftDeleteMode") } };
  }

  const db = createAnonClient();
  const { data, error } = await db.rpc("mcp_delete_transaction_draft", {
    p_key_hash: keyHash,
    p_batch_id: batchId,
    p_item_id: itemId,
    p_mode: mode,
  });

  if (error || !data) {
    return { jsonrpc: "2.0", id, error: { code: -32000, message: error?.message ?? t("mcp.errors.deleteDraftFailed") } };
  }

  const deleted = isRecord(data) ? summarizeTransactionItem(data.deleted) : null;
  return transactionOperationResponse(
    id,
    {
      operation: "delete_transaction_draft",
      status: "success",
      title: mode === "hard_delete" ? t("mcp.success.draftHardDeletedTitle") : t("mcp.success.draftRejectedTitle"),
      message: mode === "hard_delete" ? t("mcp.success.draftHardDeleted") : t("mcp.success.draftRejected"),
      batchId,
      itemId,
      counts: { deleted: 1 },
      items: deleted ? [deleted] : undefined,
    },
    data,
  );
}

async function handleToolCall(
  id: string | number | null,
  params: Record<string, unknown>,
  auth: { userId: string; keyHash: string },
  t: McpTranslator,
): Promise<McpResponse> {
  const toolName = params.name as string;

  if (MCP_MUTATION_TOOLS.has(toolName) && !(await keyHasMutationEntitlement(auth.keyHash))) {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32002, message: t("mcp.errors.subscriptionRequired") },
    };
  }

  if (toolName === "get_finance_context") {
    return handleGetFinanceContext(id, auth.keyHash, t);
  }

  if (toolName === "get_card_and_debt_balances") {
    return handleGetCardAndDebtBalances(id, auth.keyHash, t);
  }

  if (toolName === "get_transactions") {
    return handleGetTransactionsTool(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, t);
  }

  if (toolName === "create_transactions") {
    return handleCreateTransactions(id, params, auth.keyHash, t);
  }

  if (toolName === "create_transaction") {
    return handleCreateTransaction(id, params, auth.keyHash, t);
  }

  if (toolName === "update_transaction") {
    return handleUpdateTransaction(id, params, auth.keyHash, t);
  }

  if (toolName === "delete_transaction") {
    return handleDeleteTransaction(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, t);
  }

  if (toolName === "create_savings_goal") {
    return handleCreateSavingsGoal(id, params, auth.keyHash, t);
  }

  if (toolName === "update_savings_goal") {
    return handleUpdateSavingsGoal(id, params, auth.keyHash, t);
  }

  if (toolName === "delete_savings_goal") {
    return handleDeleteSavingsGoal(id, params, auth.keyHash, t);
  }

  if (toolName === "list_transaction_batches") {
    return handleListTransactionBatches(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, t);
  }

  if (toolName === "get_transaction_batch") {
    return handleGetTransactionBatch(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, t);
  }

  if (toolName === "update_transaction_draft") {
    return handleUpdateTransactionDraft(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, t);
  }

  if (toolName === "delete_transaction_draft") {
    return handleDeleteTransactionDraft(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, t);
  }

  if (toolName === "get_recurring_transaction_schedules" || toolName === "list_recurring_transactions") {
    return handleGetRecurringSchedules(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, t);
  }

  if (toolName === "create_recurring_transaction_schedule" || toolName === "create_recurring_transaction") {
    return handleCreateRecurringSchedule(id, params, auth.keyHash, t);
  }

  if (toolName === "update_recurring_transaction_schedule" || toolName === "update_recurring_transaction") {
    return handleUpdateRecurringSchedule(id, params, auth.keyHash, t);
  }

  if (toolName === "reschedule_recurring_transaction_series_from_occurrence" || toolName === "reschedule_recurring_transaction") {
    return handleRescheduleRecurringSeries(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, t);
  }

  if (toolName === "update_recurring_transaction_occurrence" || toolName === "update_recurring_occurrence") {
    return handleUpdateRecurringOccurrence(id, params, auth.keyHash, t);
  }

  if (toolName === "mark_recurring_transaction_occurrence_paid" || toolName === "mark_recurring_occurrence_paid") {
    return handleRecurringOccurrenceStatus(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, "paid", t);
  }

  if (
    toolName === "delete_recurring_transaction_occurrence" ||
    toolName === "delete_recurring_occurrence" ||
    toolName === "skip_recurring_occurrence"
  ) {
    return handleRecurringOccurrenceStatus(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, "skipped", t);
  }

  if (toolName === "set_recurring_transaction_schedule_state" || toolName === "set_recurring_transaction_state") {
    return handleSetRecurringScheduleState(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, t);
  }

  if (toolName === "delete_recurring_transaction_schedule" || toolName === "delete_recurring_transaction") {
    return handleDeleteRecurringSchedule(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, t);
  }

  if (toolName === "get_category_spending_report" || toolName === "get_budget_month_analysis") {
    return handleCategorySpendingReportTool(id, (params.arguments ?? {}) as Record<string, unknown>, auth.keyHash, t);
  }

  if (toolName !== "submit_transaction_batch") {
    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: t("mcp.errors.unknownTool", { toolName }) },
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
      error: { code: -32602, message: t("mcp.errors.transactionsRequired") },
    };
  }

  // Validate items
  for (const tx of transactions) {
    if (!tx.title || typeof tx.title !== "string") {
      return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.transactionTitleRequired") } };
    }
    if (!isPositiveNumber(tx.amount)) {
      return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.transactionPositiveAmount", { title: tx.title }) } };
    }
    if (!isIsoDate(tx.occurred_at)) {
      return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.transactionDateRequired", { title: tx.title }) } };
    }
    if (tx.kind !== "income" && tx.kind !== "expense") {
      return { jsonrpc: "2.0", id, error: { code: -32602, message: t("mcp.errors.transactionBatchKind", { title: tx.title }) } };
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
      error: { code: -32000, message: error?.message ?? t("mcp.errors.saveBatchFailed") },
    };
  }

  const { data: savedBatch } = await db.rpc("mcp_get_transaction_batch", {
    p_key_hash: auth.keyHash,
    p_batch_id: batchId,
  });
  const savedItems = isRecord(savedBatch) && Array.isArray(savedBatch.items) ? savedBatch.items : [];
  const submittedItems = savedItems.length
    ? savedItems.map(summarizeTransactionItem).filter((item): item is TransactionOperationItem => item !== null)
    : transactions.map((tx) => ({
        title: tx.title.trim(),
        amount: tx.amount,
        occurred_at: tx.occurred_at,
        kind: tx.kind,
        currency: tx.currency ?? null,
        status: "pending",
      }));

  return transactionOperationResponse(
    id,
    {
      operation: "submit_transaction_batch",
      status: "success",
      title: t("mcp.success.batchSubmittedTitle"),
      message: t("mcp.success.batchSubmitted", { count: transactions.length, batchId: String(batchId) }),
      batchId: String(batchId),
      counts: { submitted: transactions.length, pending: transactions.length },
      items: submittedItems,
    },
    { batchId, items: savedItems.length ? savedItems : items },
  );
}

// ---------------------------------------------------------------------------
// Main route handler
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  const t = (await getRequestTranslator(request)) as McpTranslator;
  const auth = await authenticateApiKey(request);
  if (!auth) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32001, message: t("mcp.errors.unauthorizedApiKey") } },
      {
        status: 401,
        headers: {
          ...CORS_HEADERS,
          "WWW-Authenticate": getMcpWwwAuthenticate(new URL(request.url).origin),
        },
      },
    );
  }

  let body: McpRequest | McpRequest[];
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32700, message: t("mcp.errors.parseError") } },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  if (Array.isArray(body)) {
    const responses = await Promise.all(body.map((msg) => dispatchMessage(msg, auth, t)));
    return NextResponse.json(responses.filter(Boolean), { headers: CORS_HEADERS });
  }

  const response = await dispatchMessage(body, auth, t);
  if (response === null) {
    return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
  }
  return NextResponse.json(response, { headers: CORS_HEADERS });
}

async function dispatchMessage(msg: McpRequest, auth: { userId: string; keyHash: string }, t: McpTranslator): Promise<McpResponse | null> {
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

    case "resources/list":
      return handleResourcesList(id);

    case "resources/read":
      return handleResourcesRead(id, t, msg.params);

    case "tools/call":
      return handleToolCall(id, (msg.params ?? {}) as Record<string, unknown>, auth, t);

    default:
      return { jsonrpc: "2.0", id, error: { code: -32601, message: t("mcp.errors.methodNotFound", { method: msg.method }) } };
  }
}
