import { describe, expect, it, vi } from "vitest";

import { BankingMutationCoordinator } from "@/features/banking/lib/optimistic-coordinator";
import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import type { TransactionImportSnapshot } from "@/types/imports";

function emptyBanking(): TransactionImportSnapshot {
  return {
    batches: [],
    rules: [],
    wallets: [],
    categories: [],
    draftTransactions: [],
    confirmedTransactions: [],
  };
}

describe("BankingMutationCoordinator", () => {
  it("publishes immediately and reconciles with the server", async () => {
    let banking = emptyBanking();
    let finance = createEmptyFinanceSnapshot();
    let resolveRequest!: (value: { banking: TransactionImportSnapshot }) => void;
    const request = new Promise<{ banking: TransactionImportSnapshot }>((resolve) => {
      resolveRequest = resolve;
    });
    const coordinator = new BankingMutationCoordinator({
      readBanking: () => banking,
      readFinance: () => finance,
      writeBanking: (next) => { banking = next; },
      writeFinance: (next) => { finance = next; },
    });

    const completion = coordinator.execute({
      id: "update",
      apply: (state) => ({
        ...state,
        banking: { ...state.banking, batches: [{ id: "optimistic" } as never] },
      }),
      request: () => request,
    });

    expect(banking.batches[0]?.id).toBe("optimistic");
    resolveRequest({ banking: { ...emptyBanking(), batches: [{ id: "server" } as never] } });
    await completion;
    await vi.waitFor(() => expect(banking.batches[0]?.id).toBe("server"));
  });

  it("rolls back a failed command without removing later optimistic work", async () => {
    let banking = emptyBanking();
    let finance = createEmptyFinanceSnapshot();
    const coordinator = new BankingMutationCoordinator({
      readBanking: () => banking,
      readFinance: () => finance,
      writeBanking: (next) => { banking = next; },
      writeFinance: (next) => { finance = next; },
    });

    const failed = coordinator.execute({
      id: "failed",
      apply: (state) => ({
        ...state,
        banking: { ...state.banking, batches: [...state.banking.batches, { id: "failed" } as never] },
      }),
      request: async () => { throw new Error("failed"); },
    });
    coordinator.execute({
      id: "kept",
      apply: (state) => ({
        ...state,
        banking: { ...state.banking, batches: [...state.banking.batches, { id: "kept" } as never] },
      }),
      request: async () => ({
        banking: { ...emptyBanking(), batches: [{ id: "kept" } as never] },
      }),
    });

    await expect(failed).rejects.toThrow("failed");
    await vi.waitFor(() => expect(banking.batches.map((batch) => batch.id)).toEqual(["kept"]));
  });
});
