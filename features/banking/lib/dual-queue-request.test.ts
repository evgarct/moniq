import { describe, expect, it, vi } from "vitest";

import { BankingMutationCoordinator } from "@/features/banking/lib/optimistic-coordinator";
import { createDualQueueRequest } from "@/features/banking/lib/dual-queue-request";
import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import { FinanceMutationCoordinator } from "@/features/finance/lib/optimistic-coordinator";
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

describe("createDualQueueRequest", () => {
  it("starts once only after both mutation queues are ready", async () => {
    const request = vi.fn(async () => "confirmed");
    const waitForRequest = createDualQueueRequest(request);

    const financeResult = waitForRequest("finance");
    expect(request).not.toHaveBeenCalled();

    const bankingResult = waitForRequest("banking");
    expect(request).toHaveBeenCalledOnce();
    expect(await financeResult).toBe("confirmed");
    expect(await bankingResult).toBe("confirmed");

    await waitForRequest("finance");
    expect(request).toHaveBeenCalledOnce();
  });

  it("waits for earlier work in both coordinators before starting", async () => {
    let banking = emptyBanking();
    let finance = createEmptyFinanceSnapshot();
    let resolveBanking!: () => void;
    let resolveFinance!: () => void;
    const bankingBlocker = new Promise<void>((resolve) => {
      resolveBanking = resolve;
    });
    const financeBlocker = new Promise<void>((resolve) => {
      resolveFinance = resolve;
    });
    const request = vi.fn(async () => ({ banking, finance }));
    const waitForRequest = createDualQueueRequest(request);
    const bankingCoordinator = new BankingMutationCoordinator({
      readBanking: () => banking,
      writeBanking: (next) => { banking = next; },
    });
    const financeCoordinator = new FinanceMutationCoordinator({
      read: () => finance,
      write: (next) => { finance = next; },
    });

    bankingCoordinator.execute({
      id: "banking-blocker",
      apply: (snapshot) => snapshot,
      request: async () => {
        await bankingBlocker;
        return banking;
      },
    });
    financeCoordinator.execute({
      id: "finance-blocker",
      apply: (snapshot) => snapshot,
      request: async () => {
        await financeBlocker;
        return finance;
      },
    });
    financeCoordinator.execute({
      id: "finance-confirm",
      apply: (snapshot) => snapshot,
      request: async () => (await waitForRequest("finance")).finance,
    });
    bankingCoordinator.execute({
      id: "banking-confirm",
      apply: (snapshot) => snapshot,
      request: async () => (await waitForRequest("banking")).banking,
    });

    resolveFinance();
    await vi.waitFor(() => expect(request).not.toHaveBeenCalled());
    resolveBanking();
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
  });
});
