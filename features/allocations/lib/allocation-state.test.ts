import { describe, expect, it } from "vitest";

import {
  createAllocation,
  deleteAllocation,
  saveAllocation,
  validateAllocationAmount,
} from "@/features/allocations/lib/allocation-state";
import type { Account, Allocation } from "@/types/finance";

const savingAccount: Account = {
  id: "wallet-2",
  user_id: "user-1",
  name: "Emergency",
  type: "saving",
  cash_kind: null,
  debt_kind: null,
  balance: 2000,
  currency: "USD",
  created_at: "2026-03-28T10:00:00.000Z",
};

const allocations: Allocation[] = [
  {
    id: "allocation-1",
    user_id: "user-1",
    account_id: "wallet-2",
    name: "Vet",
    amount: 600,
    created_at: "2026-03-28T10:00:00.000Z",
  },
];

describe("allocation-state", () => {
  it("creates a subgroup with stable shape", () => {
    const allocation = createAllocation({
      account: savingAccount,
      values: { name: "Travel", amount: 300 },
      now: "2026-03-28T12:00:00.000Z",
      idFactory: (prefix) => `${prefix}-fixed`,
    });

    expect(allocation).toEqual({
      id: "allocation-fixed",
      user_id: "user-1",
      account_id: "wallet-2",
      name: "Travel",
      amount: 300,
      created_at: "2026-03-28T12:00:00.000Z",
    });
  });

  it("rejects subgroup amounts that would exceed the savings balance", () => {
    expect(() =>
      validateAllocationAmount({
        balance: 2000,
        allocations,
        accountId: "wallet-2",
        nextAmount: 1800,
      }),
    ).toThrow("This allocation would exceed the available savings balance.");
  });

  it("allows editing an existing subgroup within its own released amount", () => {
    const result = saveAllocation({
      allocations,
      account: savingAccount,
      values: { name: "Vet", amount: 1500 },
      editingAllocation: allocations[0],
    });

    expect(result[0]?.amount).toBe(1500);
  });

  it("deletes a subgroup by id", () => {
    expect(deleteAllocation(allocations, "allocation-1")).toEqual([]);
  });
});
