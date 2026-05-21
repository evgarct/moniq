import { describe, it, expect, beforeEach, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  rpc: vi.fn(),
}));

vi.mock("@/lib/supabase/anon", () => ({
  createAnonClient: () => ({
    rpc: mocks.rpc,
  }),
}));

import { getMcpTools, OPTIONS, POST } from "./route";

const AUTH_HEADERS = {
  Authorization: "Bearer mnq_test",
  "Content-Type": "application/json",
};

function setupAuth() {
  mocks.rpc.mockImplementation((name: string) => {
    if (name === "mcp_lookup_api_key") {
      return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
    }
    if (name === "mcp_touch_api_key") {
      return Promise.resolve({ data: null, error: null });
    }
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
        capabilities: { tools: {} },
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
      "create_transactions",
      "submit_transaction_batch",
      "get_category_spending_report",
    ]);
    expect(getMcpTools().map((tool) => tool.name)).toEqual(names);
  });

  it("returns finance context with category paths and selectable flags", async () => {
    mocks.rpc.mockImplementation((name: string) => {
      if (name === "mcp_lookup_api_key") {
        return Promise.resolve({ data: [{ id: "key-1", user_id: "user-1" }], error: null });
      }
      if (name === "mcp_touch_api_key") {
        return Promise.resolve({ data: null, error: null });
      }
      if (name === "mcp_get_finance_context") {
        return Promise.resolve({
          data: {
            wallets: [{ id: "wallet-1", name: "Main", type: "cash", currency: "EUR" }],
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
    expect(body.result.structuredContent.categories).toContainEqual(
      expect.objectContaining({
        id: "cat-child",
        path: "Food / Groceries",
        is_selectable: true,
      }),
    );
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_get_finance_context", { p_user_id: "user-1" });
  });

  it("returns quick card and debt balances", async () => {
    mocks.rpc.mockImplementation((name: string) => {
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

  it("surfaces RPC validation errors for IDs outside the authenticated user", async () => {
    mocks.rpc.mockImplementation((name: string) => {
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

  it("writes valid income, expense, transfer, and debt payment payloads", async () => {
    mocks.rpc.mockImplementation((name: string) => {
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
              { id: "tx-income" },
              { id: "tx-expense" },
              { id: "tx-transfer" },
              { id: "tx-debt" },
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
    expect(body.result.structuredContent.created).toHaveLength(4);
    expect(mocks.rpc).toHaveBeenCalledWith("mcp_create_transactions", {
      p_user_id: "user-1",
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
});
