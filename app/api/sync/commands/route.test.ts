import { createHash } from "node:crypto";

import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  existingMutation: null as null | Record<string, unknown>,
  entityRecord: null as null | Record<string, unknown>,
  updateWallet: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: { id: "11111111-1111-4111-8111-111111111111" } } })) },
  })),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from(table: string) {
      let mutationData: Record<string, unknown> | null = null;
      const builder = {
        select: () => builder,
        eq: () => builder,
        maybeSingle: async () => ({ data: table === "finance_sync_mutations" ? state.existingMutation : state.entityRecord }),
        insert: async () => ({ error: null }),
        update: (data: Record<string, unknown>) => {
          mutationData = data;
          return builder;
        },
        then(resolve: (value: unknown) => unknown) {
          return Promise.resolve({ data: mutationData, error: null }).then(resolve);
        },
      };
      return builder;
    },
  }),
}));

vi.mock("@/features/finance/server/repository", () => ({
  adjustWalletBalance: vi.fn(), createCategory: vi.fn(), createTransactionEntry: vi.fn(),
  createTransactionEntryBatch: vi.fn(), createWallet: vi.fn(), createWalletAllocation: vi.fn(),
  deleteCategory: vi.fn(), deleteTransaction: vi.fn(), deleteTransactionSchedule: vi.fn(),
  deleteWallet: vi.fn(), deleteWalletAllocation: vi.fn(), getFinanceSnapshot: vi.fn(),
  markTransactionPaid: vi.fn(), rescheduleScheduleFromDate: vi.fn(),
  setTransactionScheduleState: vi.fn(), skipTransactionOccurrence: vi.fn(),
  updateCategory: vi.fn(), updateTransaction: vi.fn(), updateTransactionSchedule: vi.fn(),
  updateTransactionScheduleNote: vi.fn(),
  updateUserPreferences: vi.fn(), updateWallet: state.updateWallet, updateWalletAllocation: vi.fn(),
}));

const command = {
  id: "22222222-2222-4222-8222-222222222222",
  deviceId: "33333333-3333-4333-8333-333333333333",
  type: "wallet.update",
  targetId: "44444444-4444-4444-8444-444444444444",
  baseVersion: 3,
  createdAt: "2026-06-28T10:00:00.000Z",
  payload: { name: "Cash", type: "cash", balance: 100, currency: "USD" },
};

describe("POST /api/sync/commands", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-only";
    state.existingMutation = null;
    state.entityRecord = null;
    state.updateWallet.mockClear();
  });

  it("replays an applied idempotency result without executing the mutation again", async () => {
    state.existingMutation = {
      payload_hash: createHash("sha256").update(JSON.stringify(command)).digest("hex"),
      status: "applied",
      result: { serverVersion: 4 },
      error_code: null,
    };
    const { POST } = await import("@/app/api/sync/commands/route");
    const response = await POST(new Request("https://moniq.local/api/sync/commands", {
      method: "POST",
      body: JSON.stringify({ commands: [command] }),
    }));
    const body = await response.json();

    expect(body.results[0]).toMatchObject({ status: "applied", serverVersion: 4 });
    expect(state.updateWallet).not.toHaveBeenCalled();
  });

  it("returns a version conflict instead of applying stale data", async () => {
    state.entityRecord = { id: command.targetId, user_id: "11111111-1111-4111-8111-111111111111", sync_version: 4 };
    const { POST } = await import("@/app/api/sync/commands/route");
    const response = await POST(new Request("https://moniq.local/api/sync/commands", {
      method: "POST",
      body: JSON.stringify({ commands: [command] }),
    }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.results[0]).toMatchObject({ status: "conflict", serverVersion: 4 });
    expect(state.updateWallet).not.toHaveBeenCalled();
  });
});
