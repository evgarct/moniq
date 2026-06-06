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

    const completion = coordinator.execute({
      id: "one",
      apply: (current) => ({ ...current, categories: [{ id: "optimistic" } as never] }),
      request: () => request,
    });

    expect(snapshot.categories).toHaveLength(1);
    resolveRequest({ ...createEmptyFinanceSnapshot(), categories: [{ id: "server" } as never] });
    await completion;
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

    const failedCompletion = coordinator.execute({
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

    await expect(failedCompletion).rejects.toThrow("failed");
    await vi.waitFor(() => expect(snapshot.categories.map((category) => category.id)).toEqual(["kept"]));
  });

  it("reconciles optimistic IDs before a dependent request runs", async () => {
    let snapshot = createEmptyFinanceSnapshot();
    let resolveCreate!: (value: typeof snapshot) => void;
    const createRequest = new Promise<typeof snapshot>((resolve) => {
      resolveCreate = resolve;
    });
    const dependentRequest = vi.fn(async (resolvedParentId: string) => ({
      ...createEmptyFinanceSnapshot(),
      categories: [
        { id: "server-parent" } as never,
        { id: "server-child", parent_id: resolvedParentId } as never,
      ],
    }));
    const coordinator = new FinanceMutationCoordinator({
      read: () => snapshot,
      write: (next) => {
        snapshot = next;
      },
    });

    coordinator.execute({
      id: "create-parent",
      apply: (current) => ({
        ...current,
        categories: [...current.categories, { id: "optimistic:category:1" } as never],
      }),
      request: () => createRequest,
      reconcile: () => [["optimistic:category:1", "server-parent"]],
    });
    const dependentCompletion = coordinator.execute({
      id: "create-child",
      apply: (current, resolveId) => ({
        ...current,
        categories: [
          ...current.categories,
          { id: "optimistic:category:2", parent_id: resolveId("optimistic:category:1") } as never,
        ],
      }),
      request: (resolveId) =>
        dependentRequest(resolveId("optimistic:category:1") as string),
    });

    expect(snapshot.categories[1]?.parent_id).toBe("optimistic:category:1");
    expect(dependentRequest).not.toHaveBeenCalled();

    resolveCreate({
      ...createEmptyFinanceSnapshot(),
      categories: [{ id: "server-parent" } as never],
    });
    await dependentCompletion;

    expect(dependentRequest).toHaveBeenCalledWith("server-parent");
    expect(snapshot.categories[1]?.parent_id).toBe("server-parent");
  });
});
