import { describe, expect, it, vi } from "vitest";

import { BankingMutationCoordinator } from "@/features/banking/lib/optimistic-coordinator";
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
    let resolveRequest!: (value: TransactionImportSnapshot) => void;
    const request = new Promise<TransactionImportSnapshot>((resolve) => {
      resolveRequest = resolve;
    });
    const coordinator = new BankingMutationCoordinator({
      readBanking: () => banking,
      writeBanking: (next) => { banking = next; },
    });

    const completion = coordinator.execute({
      id: "update",
      apply: (snapshot) => ({
        ...snapshot,
        batches: [{ id: "optimistic" } as never],
      }),
      request: () => request,
    });

    expect(banking.batches[0]?.id).toBe("optimistic");
    resolveRequest({ ...emptyBanking(), batches: [{ id: "server" } as never] });
    await completion;
    await vi.waitFor(() => expect(banking.batches[0]?.id).toBe("server"));
  });

  it("rolls back a failed command without removing later optimistic work", async () => {
    let banking = emptyBanking();
    const coordinator = new BankingMutationCoordinator({
      readBanking: () => banking,
      writeBanking: (next) => { banking = next; },
    });

    const failed = coordinator.execute({
      id: "failed",
      apply: (snapshot) => ({
        ...snapshot,
        batches: [...snapshot.batches, { id: "failed" } as never],
      }),
      request: async () => { throw new Error("failed"); },
    });
    coordinator.execute({
      id: "kept",
      apply: (snapshot) => ({
        ...snapshot,
        batches: [...snapshot.batches, { id: "kept" } as never],
      }),
      request: async () => ({
        ...emptyBanking(),
        batches: [{ id: "kept" } as never],
      }),
    });

    await expect(failed).rejects.toThrow("failed");
    await vi.waitFor(() => expect(banking.batches.map((batch) => batch.id)).toEqual(["kept"]));
  });
});
