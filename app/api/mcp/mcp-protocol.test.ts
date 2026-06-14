import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/anon", () => ({
  createAnonClient: () => ({
    rpc: mocks.rpc,
  }),
}));

import { getMcpTools, getMcpWwwAuthenticate, OPTIONS, POST } from "./route";

const AUTH_HEADERS = {
  Authorization: "Bearer mnq_test",
  "Content-Type": "application/json",
};
const AUTH_KEY_HASH = "4e9c2607dbc70aac6e1c00a5971f3929addde44c0c00f508d6f0952865ea5627";

function authRpcResponse(name: string) {
  if (name === "mcp_lookup_api_key") {
    return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
  }
  if (name === "mcp_touch_api_key") {
    return Promise.resolve({ data: null, error: null });
  }
  if (name === "mcp_key_has_mutation_entitlement") {
    return Promise.resolve({ data: true, error: null });
  }
  return null;
}

function setupAuth() {
  mocks.rpc.mockImplementation((name: string) => {
    const authResponse = authRpcResponse(name);
    if (authResponse) return authResponse;
    return Promise.resolve({ data: null, error: null });
  });
}

async function postMcp(body: unknown) {
  return POST(
    new Request("https://moniq.test/api/mcp", {
      method: "POST",
      headers: AUTH_HEADERS,
      body: JSON.stringify(body),
    }),
  );
}

describe("MCP CORS", () => {
  it("OPTIONS returns 204 with CORS headers", async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Mcp-Session-Id");
  });
});

describe("MCP authentication metadata", () => {
  it("advertises the official resource metadata URL", () => {
    expect(getMcpWwwAuthenticate()).toBe(
      'Bearer realm="moniq", resource_metadata="https://moniq.fyi/.well-known/oauth-protected-resource"',
    );
  });

  it("advertises the current deployment when no app URL is configured", () => {
    const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    try {
      expect(getMcpWwwAuthenticate("https://preview.example.dev")).toBe(
        'Bearer realm="moniq", resource_metadata="https://preview.example.dev/.well-known/oauth-protected-resource"',
      );
    } finally {
      if (originalAppUrl === undefined) {
        delete process.env.NEXT_PUBLIC_APP_URL;
      } else {
        process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
      }
    }
  });
});

describe("MCP initialize", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    setupAuth();
  });

  it("negotiates supported protocol versions", async () => {
    const response = await postMcp({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: { protocolVersion: "2024-11-05" },
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      jsonrpc: "2.0",
      id: 1,
      result: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {}, resources: {} },
        serverInfo: { name: "moniq", version: "1.0.0" },
      },
    });
  });
});

describe("MCP tools", () => {
  beforeEach(() => {
    mocks.rpc.mockReset();
    setupAuth();
  });

  it("lists direct transaction, balance, batch, and spending report tools", async () => {
    const response = await postMcp({
      jsonrpc: "2.0",
      id: "tools",
      method: "tools/list",
    });

    const body = await response.json();
    const names = body.result.tools.map((tool: { name: string }) => tool.name);
    expect(names).toEqual([
      "get_finance_context",
      "get_card_and_debt_balances",
      "get_transactions",
      "create_transactions",
      "update_transaction",
      "delete_transaction",
      "get_recurring_transaction_schedules",
      "create_recurring_transaction_schedule",
      "update_recurring_transaction_schedule",
      "reschedule_recurring_transaction_series_from_occurrence",
      "update_recurring_transaction_occurrence",
      "mark_recurring_transaction_occurrence_paid",
      "delete_recurring_transaction_occurrence",
      "set_recurring_transaction_schedule_state",
      "delete_recurring_transaction_schedule",
      "list_recurring_transactions",
      "create_recurring_transaction",
      "update_recurring_transaction",
      "set_recurring_transaction_state",
      "delete_recurring_transaction",
      "reschedule_recurring_transaction",
      "update_recurring_occurrence",
      "mark_recurring_occurrence_paid",
      "skip_recurring_occurrence",
      "delete_recurring_occurrence",
      "list_transaction_batches",
      "get_transaction_batch",
      "update_transaction_draft",
      "delete_transaction_draft",
      "submit_transaction_batch",
      "get_category_spending_report",
      "get_budget_month_analysis",
    ]);
    expect(getMcpTools().map((tool) => tool.name)).toEqual(names);
  });

  it("returns budget month analysis through the spending report source RPC", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      const authResponse = authRpcResponse(name);
      if (authResponse) return authResponse;
      if (name === "mcp_lookup_api_key") {
        return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
      }
      if (name === "mcp_touch_api_key") {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "mcp_get_category_spending_report_source") {
        return Promise.resolve({
          data: {
            wallets: [
              {
                id: "wallet-1",
                user_id: "user-1",
                name: "Main",
                type: "cash",
                cash_kind: "debit_card",
                debt_kind: null,
                balance: 0,
                credit_limit: null,
                currency: "EUR",
                created_at: "2026-01-01",
              },
            ],
            categories: [
              {
                id: "income-root",
                user_id: "user-1",
                name: "Income",
                description: null,
                icon: null,
                type: "income",
                parent_id: null,
                is_system: false,
                created_at: "2026-01-01",
              },
              {
                id: "salary",
                user_id: "user-1",
                name: "Salary",
                description: null,
                icon: null,
                type: "income",
                parent_id: "income-root",
                is_system: false,
                created_at: "2026-01-01",
              },
              {
                id: "living",
                user_id: "user-1",
                name: "Living",
                description: null,
                icon: null,
                type: "expense",
                parent_id: null,
                is_system: false,
                created_at: "2026-01-01",
              },
              {
                id: "food",
                user_id: "user-1",
                name: "Food",
                description: null,
                icon: null,
                type: "expense",
                parent_id: "living",
                is_system: false,
                created_at: "2026-01-01",
              },
            ],
            transactions: [
              {
                id: "salary-1",
                user_id: "user-1",
                title: "Salary",
                note: null,
                occurred_at: "2026-04-05",
                created_at: "2026-04-05",
                status: "paid",
                kind: "income",
                amount: 1000,
                destination_amount: null,
                fx_rate: null,
                principal_amount: null,
                interest_amount: null,
                extra_principal_amount: null,
                category_id: "salary",
                source_account_id: null,
                destination_account_id: "wallet-1",
                schedule_id: null,
                schedule_occurrence_date: null,
                is_schedule_override: false,
                allocation_id: null,
              },
              {
                id: "food-1",
                user_id: "user-1",
                title: "Groceries",
                note: null,
                occurred_at: "2026-04-06",
                created_at: "2026-04-06",
                status: "paid",
                kind: "expense",
                amount: 250,
                destination_amount: null,
                fx_rate: null,
                principal_amount: null,
                interest_amount: null,
                extra_principal_amount: null,
                category_id: "food",
                source_account_id: "wallet-1",
                destination_account_id: null,
                schedule_id: null,
                schedule_occurrence_date: null,
                is_schedule_override: false,
                allocation_id: null,
              },
            ],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await postMcp({
      jsonrpc: "2.0",
      id: "budget-month",
      method: "tools/call",
      params: {
        name: "get_budget_month_analysis",
        arguments: { month: "2026-04" },
      },
    });

    const body = await response.json();
    expect(body.result.structuredContent.summary).toMatchObject({
      month: "2026-04",
      transaction_count: 2,
      currencies: [{ currency: "EUR", income_total: 1000, expense_total: 250, net: 750, transaction_count: 2 }],
    });
    expect(body.result.structuredContent.envelopes[0]).toMatchObject({
      name: "Living",
      totals: [{ currency: "EUR", amount: 250, percent_of_income: 25, percent_of_total_expenses: 100 }],
    });
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_get_category_spending_report_source", {
      p_key_hash: AUTH_KEY_HASH,
      p_start_date: "2026-04-01",
      p_end_date: "2026-04-30",
    });
  });

  it("does not expose savings bucket management through MCP tool schemas", () => {
    const tools = getMcpTools();
    const names = tools.map((tool) => tool.name);
    const schemaText = JSON.stringify(tools).toLowerCase();

    expect(names).not.toContain("get_wallet_allocations");
    expect(names).not.toContain("create_wallet_allocation");
    expect(names).not.toContain("update_wallet_allocation");
    expect(names).not.toContain("delete_wallet_allocation");
    expect(names).not.toContain("spend_from_goal");
    expect(schemaText).not.toContain("wallet_allocations");
    expect(schemaText).not.toContain("allocation_id");
    expect(schemaText).not.toContain("savings goal");
  });

  it("exposes human-readable metadata for ChatGPT confirmations", async () => {
    const createTransactionsTool = getMcpTools().find((tool) => tool.name === "create_transactions");

    expect(createTransactionsTool).toMatchObject({
      title: "Add ledger transactions to Moniq",
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: false,
      },
      _meta: {
        "openai/outputTemplate": "ui://moniq/finance-result.html",
        "openai/toolInvocation/invoking": "Adding records to Moniq",
        "openai/toolInvocation/invoked": "Moniq records added",
      },
      outputSchema: {
        title: "Created transactions",
      },
    });
    expect(createTransactionsTool?.inputSchema).toMatchObject({
      title: "Transactions to add",
      properties: {
        transactions: {
          title: "Transactions",
          items: {
            properties: {
              source_account_id: { title: "From wallet" },
              category_id: { title: "Category" },
            },
          },
        },
      },
    });
  });

  it("keeps the singular create alias callable but hidden from discovery", async () => {
    expect(getMcpTools().map((tool) => tool.name)).not.toContain("create_transaction");

    mocks.rpc.mockImplementation((name: string) => {
      const authResponse = authRpcResponse(name);
      if (authResponse) return authResponse;
      if (name === "mcp_create_transactions") {
        return Promise.resolve({
          data: {
            created: [
              {
                id: "6f587413-6c44-4d65-9958-a5b623ea9958",
                title: "Coffee",
                amount: 4.5,
                occurred_at: "2026-06-14",
                kind: "expense",
              },
            ],
          },
          error: null,
        });
      }
      if (name === "mcp_get_transaction_widget_items") {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await postMcp({
      jsonrpc: "2.0",
      id: "legacy-create",
      method: "tools/call",
      params: {
        name: "create_transaction",
        arguments: {
          transaction: {
            title: "Coffee",
            kind: "expense",
            status: "paid",
            amount: 4.5,
            occurred_at: "2026-06-14",
            source_account_id: "wallet-cash",
            category_id: "cat-coffee",
          },
        },
      },
    });

    await expect(response.json()).resolves.toMatchObject({
      result: {
        structuredContent: {
          operation: "create_transaction",
          counts: { created: 1 },
        },
      },
    });
  });

  it("exposes transaction edit/delete tools with correct safety annotations and widget metadata", () => {
    const tools = getMcpTools();
    const updateDraftTool = tools.find((tool) => tool.name === "update_transaction_draft");
    const deleteDraftTool = tools.find((tool) => tool.name === "delete_transaction_draft");
    const deleteTransactionTool = tools.find((tool) => tool.name === "delete_transaction");

    expect(updateDraftTool).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: false },
      _meta: { "openai/outputTemplate": "ui://moniq/finance-result.html" },
      outputSchema: { title: "Updated draft transaction" },
    });
    expect(deleteDraftTool).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: true },
      _meta: { "openai/outputTemplate": "ui://moniq/finance-result.html" },
    });
    expect(deleteTransactionTool).toMatchObject({
      annotations: { readOnlyHint: false, destructiveHint: true },
      _meta: { "openai/outputTemplate": "ui://moniq/finance-result.html" },
    });
  });

  it("serves the ChatGPT transaction result widget resource", async () => {
    const listResponse = await postMcp({
      jsonrpc: "2.0",
      id: "resources",
      method: "resources/list",
    });
    const listBody = await listResponse.json();
    expect(listBody.result.resources[0]).toMatchObject({
      uri: "ui://moniq/finance-result.html",
      mimeType: "text/html;profile=mcp-app",
    });

    const readResponse = await postMcp({
      jsonrpc: "2.0",
      id: "resource",
      method: "resources/read",
      params: { uri: "ui://moniq/finance-result.html" },
    });
    const readBody = await readResponse.json();
    expect(readBody.result.contents[0]).toMatchObject({
      uri: "ui://moniq/finance-result.html",
      mimeType: "text/html;profile=mcp-app",
    });
    expect(readBody.result.contents[0].text).toContain("ui/notifications/tool-result");
  });

  it("returns finance context with category paths and selectable flags", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      const authResponse = authRpcResponse(name);
      if (authResponse) return authResponse;
      if (name === "mcp_lookup_api_key") {
        return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
      }
      if (name === "mcp_touch_api_key") {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "mcp_get_finance_context") {
        return Promise.resolve({
          data: {
            wallets: [
              {
                id: "wallet-1",
                name: "Main",
                type: "cash",
                currency: "EUR",
                allocations: [{ id: "hidden-allocation" }],
              },
            ],
            allocations: [{ id: "hidden-root-allocation" }],
            categories: [
              {
                id: "cat-parent",
                type: "expense",
                name: "Food",
                path: "Food",
                parent_id: null,
                is_selectable: false,
              },
              {
                id: "cat-child",
                type: "expense",
                name: "Groceries",
                path: "Food / Groceries",
                parent_id: "cat-parent",
                is_selectable: true,
              },
            ],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await postMcp({
      jsonrpc: "2.0",
      id: "ctx",
      method: "tools/call",
      params: { name: "get_finance_context", arguments: {} },
    });

    const body = await response.json();
    expect(body.result.structuredContent).not.toHaveProperty("allocations");
    expect(body.result.structuredContent.wallets[0]).not.toHaveProperty("allocations");
    expect(body.result.content[0].text).not.toContain("hidden-allocation");
    expect(body.result.structuredContent.categories).toContainEqual(
      expect.objectContaining({
        id: "cat-child",
        path: "Food / Groceries",
        is_selectable: true,
      }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_get_finance_context", { p_key_hash: AUTH_KEY_HASH });
  });

  it("returns quick card and debt balances", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      const authResponse = authRpcResponse(name);
      if (authResponse) return authResponse;
      if (name === "mcp_lookup_api_key") {
        return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
      }
      if (name === "mcp_touch_api_key") {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "mcp_get_finance_context") {
        return Promise.resolve({
          data: {
            wallets: [
              {
                id: "wallet-debit",
                name: "Main card",
                type: "cash",
                cash_kind: "debit_card",
                currency: "EUR",
                balance: "1234.56",
                credit_limit: null,
              },
              {
                id: "wallet-credit",
                name: "Credit card",
                type: "credit_card",
                cash_kind: null,
                currency: "EUR",
                balance: "-250.00",
                credit_limit: "1000.00",
              },
              {
                id: "wallet-loan",
                name: "Loan",
                type: "debt",
                debt_kind: "loan",
                currency: "EUR",
                balance: "-5000.00",
                credit_limit: null,
              },
              {
                id: "wallet-cash",
                name: "Cash envelope",
                type: "cash",
                cash_kind: "cash_wallet",
                currency: "EUR",
                balance: "100.00",
                credit_limit: null,
              },
            ],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await postMcp({
      jsonrpc: "2.0",
      id: "balances",
      method: "tools/call",
      params: { name: "get_card_and_debt_balances", arguments: {} },
    });

    const body = await response.json();
    expect(body.result.structuredContent.cards).toEqual([
      expect.objectContaining({
        id: "wallet-debit",
        balance: 1234.56,
        outstanding_amount: 0,
      }),
      expect.objectContaining({
        id: "wallet-credit",
        balance: -250,
        outstanding_amount: 250,
        available_credit: 750,
      }),
    ]);
    expect(body.result.structuredContent.debts).toEqual([
      expect.objectContaining({
        id: "wallet-loan",
        outstanding_amount: 5000,
      }),
    ]);
    expect(body.result.structuredContent.totals_by_currency).toMatchObject({
      credit_card_outstanding: [{ currency: "EUR", amount: 250 }],
      debts_outstanding: [{ currency: "EUR", amount: 5000 }],
    });
  });

  it("rejects transaction range requests with invalid dates", async () => {
    const response = await postMcp({
      jsonrpc: "2.0",
      id: "tx-range-invalid",
      method: "tools/call",
      params: {
        name: "get_transactions",
        arguments: {
          start_date: "2026-05",
          end_date: "2026-05-31",
        },
      },
    });

    const body = await response.json();
    expect(body.error).toMatchObject({
      code: -32602,
      message: "start_date and end_date must be provided in YYYY-MM-DD format.",
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("mcp_get_transactions_for_period", expect.anything());
  });

  it("rejects transaction range requests with non-existent calendar dates", async () => {
    const response = await postMcp({
      jsonrpc: "2.0",
      id: "tx-range-invalid-calendar-date",
      method: "tools/call",
      params: {
        name: "get_transactions",
        arguments: {
          start_date: "2026-02-31",
          end_date: "2026-03-31",
        },
      },
    });

    const body = await response.json();
    expect(body.error).toMatchObject({
      code: -32602,
      message: "start_date and end_date must be provided in YYYY-MM-DD format.",
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("mcp_get_transactions_for_period", expect.anything());
  });

  it("rejects transaction range requests when start is after end", async () => {
    const response = await postMcp({
      jsonrpc: "2.0",
      id: "tx-range-reversed",
      method: "tools/call",
      params: {
        name: "get_transactions",
        arguments: {
          start_date: "2026-06-01",
          end_date: "2026-05-31",
        },
      },
    });

    const body = await response.json();
    expect(body.error).toMatchObject({
      code: -32602,
      message: "start_date must be on or before end_date.",
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("mcp_get_transactions_for_period", expect.anything());
  });

  it("returns transactions for a date range through the key-hash RPC", async () => {
    const rpcPayload = {
      period: { start_date: "2026-05-01", end_date: "2026-07-31" },
      transactions: [
        {
          id: "tx-paid",
          source: "ledger",
          is_generated: false,
          title: "Salary",
          occurred_at: "2026-05-20",
          status: "paid",
          kind: "income",
          amount: 5000,
          currency: "EUR",
        },
        {
          id: "tx-planned",
          source: "ledger",
          is_generated: false,
          title: "Future transfer",
          occurred_at: "2026-06-01",
          status: "planned",
          kind: "transfer",
          amount: 300,
          currency: "EUR",
        },
        {
          id: "schedule:schedule-1:2026-07-01",
          source: "schedule",
          is_generated: true,
          title: "Rent",
          occurred_at: "2026-07-01",
          status: "planned",
          kind: "expense",
          amount: 1200,
          currency: "EUR",
          schedule_id: "schedule-1",
          schedule_occurrence_date: "2026-07-01",
        },
        {
          id: "tx-debt",
          source: "ledger",
          is_generated: false,
          title: "Loan payment",
          occurred_at: "2026-07-15",
          status: "paid",
          kind: "debt_payment",
          amount: 750,
          currency: "EUR",
        },
      ],
      summary_by_currency: [{ currency: "EUR", transaction_count: 4, total_amount: 7250 }],
      limits: { max_transactions: 5000, returned_transactions: 4 },
      accounts: [{ id: "wallet-main", name: "Main", currency: "EUR" }],
      categories: [{ id: "cat-rent", name: "Rent", type: "expense" }],
      schedules: [{ id: "schedule-1", title: "Rent", frequency: "monthly" }],
    };

    mocks.rpc.mockImplementation((name: string) => {
      const authResponse = authRpcResponse(name);
      if (authResponse) return authResponse;
      if (name === "mcp_lookup_api_key") {
        return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
      }
      if (name === "mcp_touch_api_key") {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "mcp_get_transactions_for_period") {
        return Promise.resolve({ data: rpcPayload, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await postMcp({
      jsonrpc: "2.0",
      id: "tx-range",
      method: "tools/call",
      params: {
        name: "get_transactions",
        arguments: {
          start_date: "2026-05-01",
          end_date: "2026-07-31",
          statuses: ["paid", "planned", "skipped"],
          kinds: ["income", "expense", "transfer", "debt_payment"],
          account_ids: ["wallet-main"],
          category_ids: ["cat-rent"],
          include_context: true,
        },
      },
    });

    const body = await response.json();
    expect(body.result.structuredContent).toEqual(rpcPayload);
    expect(body.result.structuredContent.transactions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "paid", kind: "income" }),
        expect.objectContaining({ status: "planned", kind: "transfer" }),
        expect.objectContaining({ source: "schedule", is_generated: true, schedule_id: "schedule-1" }),
        expect.objectContaining({ status: "paid", kind: "debt_payment" }),
      ]),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_get_transactions_for_period", {
      p_key_hash: AUTH_KEY_HASH,
      p_start_date: "2026-05-01",
      p_end_date: "2026-07-31",
      p_statuses: ["paid", "planned", "skipped"],
      p_kinds: ["income", "expense", "transfer", "debt_payment"],
      p_account_ids: ["wallet-main"],
      p_category_ids: ["cat-rent"],
      p_include_context: true,
    });
  });

  it("blocks MCP mutation tools without a billing entitlement", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "mcp_lookup_api_key") {
        return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
      }
      if (name === "mcp_touch_api_key") {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "mcp_key_has_mutation_entitlement") {
        return Promise.resolve({ data: false, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await postMcp({
      jsonrpc: "2.0",
      id: "create-blocked",
      method: "tools/call",
      params: {
        name: "create_transactions",
        arguments: {
          transactions: [],
        },
      },
    });

    const body = await response.json();
    expect(body.error).toMatchObject({
      code: -32002,
      message: "An active Moniq subscription is required to change data. Read-only tools remain available.",
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("mcp_create_transactions", expect.anything());
  });

  it("rejects direct creation when required fields are missing", async () => {
    const response = await postMcp({
      jsonrpc: "2.0",
      id: "create-missing",
      method: "tools/call",
      params: {
        name: "create_transactions",
        arguments: {
          transactions: [
            {
              title: "Coffee",
              kind: "expense",
              status: "paid",
              amount: 4.5,
              occurred_at: "2026-05-21",
              source_account_id: "wallet-cash",
            },
          ],
        },
      },
    });

    const body = await response.json();
    expect(body.error).toMatchObject({
      code: -32602,
      message: expect.stringContaining("category_id"),
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("mcp_create_transactions", expect.anything());
  });

  it("rejects null transaction entries before field access", async () => {
    const response = await postMcp({
      jsonrpc: "2.0",
      id: "create-null",
      method: "tools/call",
      params: {
        name: "create_transactions",
        arguments: {
          transactions: [null],
        },
      },
    });

    const body = await response.json();
    expect(body.error).toMatchObject({
      code: -32602,
      message: "Transaction 1 must be an object",
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("mcp_create_transactions", expect.anything());
  });

  it("surfaces RPC validation errors for IDs outside the authenticated user", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      const authResponse = authRpcResponse(name);
      if (authResponse) return authResponse;
      if (name === "mcp_lookup_api_key") {
        return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
      }
      if (name === "mcp_touch_api_key") {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "mcp_create_transactions") {
        return Promise.resolve({ data: null, error: { message: 'Transaction "Coffee" category not found' } });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await postMcp({
      jsonrpc: "2.0",
      id: "create-outside-user",
      method: "tools/call",
      params: {
        name: "create_transactions",
        arguments: {
          transactions: [
            {
              title: "Coffee",
              kind: "expense",
              status: "paid",
              amount: 4.5,
              occurred_at: "2026-05-21",
              source_account_id: "wallet-cash",
              category_id: "other-user-category",
            },
          ],
        },
      },
    });

    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: -32000,
        message: 'Transaction "Coffee" category not found',
      },
    });
  });

  it("preserves Unicode transaction titles and notes", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      const authResponse = authRpcResponse(name);
      if (authResponse) return authResponse;
      if (name === "mcp_create_transactions") {
        return Promise.resolve({
          data: {
            created: [
              {
                id: "97df80c8-ffb6-46e5-b3fc-01b4cc90d7be",
                title: "Hotovost na účet — проценты",
                amount: 149.61,
                occurred_at: "2026-05-16",
                kind: "expense",
              },
            ],
          },
          error: null,
        });
      }
      if (name === "mcp_get_transaction_widget_items") {
        return Promise.resolve({ data: [], error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    await postMcp({
      jsonrpc: "2.0",
      id: "unicode-create",
      method: "tools/call",
      params: {
        name: "create_transactions",
        arguments: {
          transactions: [
            {
              title: "Hotovost na účet — проценты",
              note: "Raiffeisenbank. Úrok za převod.",
              kind: "expense",
              status: "paid",
              amount: 149.61,
              occurred_at: "2026-05-16",
              source_account_id: "wallet-credit",
              category_id: "cat-loans",
            },
          ],
        },
      },
    });

    expect(mocks.rpc).toHaveBeenCalledWith("mcp_create_transactions", {
      p_key_hash: AUTH_KEY_HASH,
      p_transactions: [
        expect.objectContaining({
          title: "Hotovost na účet — проценты",
          note: "Raiffeisenbank. Úrok za převod.",
        }),
      ],
    });
  });

  it("writes valid income, expense, transfer, and debt payment payloads", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      const authResponse = authRpcResponse(name);
      if (authResponse) return authResponse;
      if (name === "mcp_lookup_api_key") {
        return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
      }
      if (name === "mcp_touch_api_key") {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "mcp_create_transactions") {
        return Promise.resolve({
          data: {
            created: [
              { id: "tx-income", title: "Salary", amount: 5000, occurred_at: "2026-05-20", kind: "income" },
              { id: "tx-expense", title: "Groceries", amount: 82.4, occurred_at: "2026-05-21", kind: "expense" },
              { id: "tx-transfer", title: "Move to savings", amount: 300, occurred_at: "2026-05-22", kind: "transfer" },
              { id: "tx-debt", title: "Loan payment", amount: 750, occurred_at: "2026-05-23", kind: "debt_payment" },
            ],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const transactions = [
      {
        title: "Salary",
        note: "May payroll",
        kind: "income",
        status: "paid",
        amount: 5000,
        occurred_at: "2026-05-20",
        destination_account_id: "wallet-main",
        category_id: "cat-salary",
      },
      {
        title: "Groceries",
        note: "  Store receipt  ",
        kind: "expense",
        status: "paid",
        amount: 82.4,
        occurred_at: "2026-05-21",
        source_account_id: "wallet-main",
        category_id: "cat-groceries",
      },
      {
        title: "Move to savings",
        note: "",
        kind: "transfer",
        status: "planned",
        amount: 300,
        destination_amount: 300,
        occurred_at: "2026-05-22",
        source_account_id: "wallet-main",
        destination_account_id: "wallet-savings",
      },
      {
        title: "Loan payment",
        kind: "debt_payment",
        status: "paid",
        amount: 750,
        occurred_at: "2026-05-23",
        source_account_id: "wallet-main",
        destination_account_id: "wallet-loan",
        category_id: "cat-interest",
        principal_amount: 700,
        interest_amount: 50,
        extra_principal_amount: 0,
      },
    ];

    const response = await postMcp({
      jsonrpc: "2.0",
      id: "create-all",
      method: "tools/call",
      params: {
        name: "create_transactions",
        arguments: { transactions },
      },
    });

    const body = await response.json();
    expect(body.result.structuredContent).toMatchObject({
      operation: "create_transactions",
      status: "success",
      counts: { created: 4 },
    });
    expect(body.result.structuredContent.items).toHaveLength(4);
    expect(body.result._meta.operationResult.created).toHaveLength(4);
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_create_transactions", {
      p_key_hash: AUTH_KEY_HASH,
      p_transactions: [
        expect.objectContaining({
          title: "Salary",
          note: "May payroll",
          kind: "income",
          source_account_id: null,
          destination_account_id: "wallet-main",
          category_id: "cat-salary",
        }),
        expect.objectContaining({
          title: "Groceries",
          note: "Store receipt",
          kind: "expense",
          source_account_id: "wallet-main",
          destination_account_id: null,
          category_id: "cat-groceries",
        }),
        expect.objectContaining({
          title: "Move to savings",
          note: null,
          kind: "transfer",
          source_account_id: "wallet-main",
          destination_account_id: "wallet-savings",
          category_id: null,
        }),
        expect.objectContaining({
          title: "Loan payment",
          kind: "debt_payment",
          principal_amount: 700,
          interest_amount: 50,
          extra_principal_amount: 0,
          category_id: "cat-interest",
        }),
      ],
    });
  });

  it("creates recurring transaction schedules through key-hash RPCs", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      const authResponse = authRpcResponse(name);
      if (authResponse) return authResponse;
      if (name === "mcp_lookup_api_key") {
        return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
      }
      if (name === "mcp_touch_api_key") {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "mcp_create_recurring_transaction_schedule") {
        return Promise.resolve({ data: { schedule_id: "schedule-1" }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const schedule = {
      title: "Rent",
      start_date: "2026-05-10",
      frequency: "yearly",
      until_date: null,
      kind: "expense",
      amount: 1200,
      source_account_id: "wallet-main",
      category_id: "cat-rent",
    };

    const response = await postMcp({
      jsonrpc: "2.0",
      id: "create-recurring",
      method: "tools/call",
      params: {
        name: "create_recurring_transaction_schedule",
        arguments: { schedule },
      },
    });

    await expect(response.json()).resolves.toMatchObject({
      result: {
        structuredContent: { schedule_id: "schedule-1" },
      },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_create_recurring_transaction_schedule", {
      p_key_hash: AUTH_KEY_HASH,
      p_schedule: expect.objectContaining({
        title: "Rent",
        start_date: "2026-05-10",
        frequency: "yearly",
        interval_weeks: 1,
        kind: "expense",
        amount: 1200,
        source_account_id: "wallet-main",
        category_id: "cat-rent",
      }),
    });
  });

  it("creates every-n-weeks recurring transaction schedules through alias tools", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      const authResponse = authRpcResponse(name);
      if (authResponse) return authResponse;
      if (name === "mcp_lookup_api_key") {
        return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
      }
      if (name === "mcp_touch_api_key") {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "mcp_create_recurring_transaction_schedule") {
        return Promise.resolve({ data: { schedule_id: "schedule-2" }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await postMcp({
      jsonrpc: "2.0",
      id: "create-recurring-alias",
      method: "tools/call",
      params: {
        name: "create_recurring_transaction",
        arguments: {
          schedule: {
            title: "Cleaner",
            start_date: "2026-05-10",
            frequency: "weekly",
            interval_weeks: 3,
            kind: "expense",
            amount: 80,
            source_account_id: "wallet-main",
            category_id: "cat-home",
          },
        },
      },
    });

    await expect(response.json()).resolves.toMatchObject({
      result: {
        structuredContent: { schedule_id: "schedule-2" },
      },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_create_recurring_transaction_schedule", {
      p_key_hash: AUTH_KEY_HASH,
      p_schedule: expect.objectContaining({
        frequency: "weekly",
        interval_weeks: 3,
      }),
    });
  });

  it("rejects recurring schedules when the end date is before the first occurrence", async () => {
    const response = await postMcp({
      jsonrpc: "2.0",
      id: "create-recurring-invalid",
      method: "tools/call",
      params: {
        name: "create_recurring_transaction_schedule",
        arguments: {
          schedule: {
            title: "Rent",
            start_date: "2026-05-10",
            frequency: "monthly",
            until_date: "2026-05-01",
            kind: "expense",
            amount: 1200,
            source_account_id: "wallet-main",
            category_id: "cat-rent",
          },
        },
      },
    });

    await expect(response.json()).resolves.toMatchObject({
      error: {
        code: -32602,
        message: expect.stringContaining("until_date"),
      },
    });
    expect(mocks.rpc).not.toHaveBeenCalledWith("mcp_create_recurring_transaction_schedule", expect.anything());
  });

  it("materializes and marks a generated recurring occurrence paid", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      const authResponse = authRpcResponse(name);
      if (authResponse) return authResponse;
      if (name === "mcp_lookup_api_key") {
        return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
      }
      if (name === "mcp_touch_api_key") {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "mcp_set_recurring_transaction_occurrence_status") {
        return Promise.resolve({ data: { transaction_id: "tx-1", status: "paid" }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const response = await postMcp({
      jsonrpc: "2.0",
      id: "pay-recurring",
      method: "tools/call",
      params: {
        name: "mark_recurring_transaction_occurrence_paid",
        arguments: {
          schedule_id: "schedule-1",
          occurrence_date: "2026-05-10",
        },
      },
    });

    await expect(response.json()).resolves.toMatchObject({
      result: {
        structuredContent: { transaction_id: "tx-1", status: "paid" },
      },
    });
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_set_recurring_transaction_occurrence_status", {
      p_key_hash: AUTH_KEY_HASH,
      p_transaction_id: null,
      p_schedule_id: "schedule-1",
      p_occurrence_date: "2026-05-10",
      p_status: "paid",
    });
  });
});
