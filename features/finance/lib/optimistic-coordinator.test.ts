import { describe, expect, it, vi } from "vitest";

import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import { FinanceMutationCoordinator } from "@/features/finance/lib/optimistic-coordinator";

describe("FinanceMutationCoordinator", () => {
  it("applies immediately and reconciles with the server", async () => {
    let snapshot = createEmptyFinanceSnapshot();
    let resolveRequest!: (value: typeof snapshot) => void;
    const request = new Promise<typeof snapshot>((resolve) => {
      resolveRequest = resolve;
    });
    const coordinator = new FinanceMutationCoordinator({
      read: () => snapshot,
      write: (next) => {
        snapshot = next;
      },
    });

    coordinator.execute({
      id: "one",
      apply: (current) => ({ ...current, categories: [{ id: "optimistic" } as never] }),
      request: () => request,
    });

    expect(snapshot.categories).toHaveLength(1);
    resolveRequest({ ...createEmptyFinanceSnapshot(), categories: [{ id: "server" } as never] });
    await vi.waitFor(() => expect(snapshot.categories[0]?.id).toBe("server"));
  });

  it("serializes requests and preserves later optimistic commands", async () => {
    let snapshot = createEmptyFinanceSnapshot();
    let resolveFirst!: (value: typeof snapshot) => void;
    const firstRequest = new Promise<typeof snapshot>((resolve) => {
      resolveFirst = resolve;
    });
    const secondRequest = vi.fn(async () => ({
      ...createEmptyFinanceSnapshot(),
      categories: [{ id: "first" } as never, { id: "second" } as never],
    }));
    const coordinator = new FinanceMutationCoordinator({
      read: () => snapshot,
      write: (next) => {
        snapshot = next;
      },
    });

    coordinator.execute({
      id: "one",
      apply: (current) => ({ ...current, categories: [...current.categories, { id: "first" } as never] }),
      request: () => firstRequest,
    });
    coordinator.execute({
      id: "two",
      apply: (current) => ({ ...current, categories: [...current.categories, { id: "second" } as never] }),
      request: secondRequest,
    });

    expect(snapshot.categories.map((category) => category.id)).toEqual(["first", "second"]);
    expect(secondRequest).not.toHaveBeenCalled();

    resolveFirst({ ...createEmptyFinanceSnapshot(), categories: [{ id: "first" } as never] });
    await vi.waitFor(() => expect(secondRequest).toHaveBeenCalledOnce());
    await vi.waitFor(() =>
      expect(snapshot.categories.map((category) => category.id)).toEqual(["first", "second"]),
    );
  });

  it("rolls back only the failed command and reapplies pending work", async () => {
    let snapshot = createEmptyFinanceSnapshot();
    const coordinator = new FinanceMutationCoordinator({
      read: () => snapshot,
      write: (next) => {
        snapshot = next;
      },
    });

    coordinator.execute({
      id: "failed",
      apply: (current) => ({ ...current, categories: [...current.categories, { id: "failed" } as never] }),
      request: async () => {
        throw new Error("failed");
      },
    });
    coordinator.execute({
      id: "kept",
      apply: (current) => ({ ...current, categories: [...current.categories, { id: "kept" } as never] }),
      request: async () => ({ ...createEmptyFinanceSnapshot(), categories: [{ id: "kept" } as never] }),
    });

    await vi.waitFor(() => expect(snapshot.categories.map((category) => category.id)).toEqual(["kept"]));
  });
});
