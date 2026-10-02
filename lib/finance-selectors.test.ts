import { describe, expect, it } from "vitest";

import { getEffectiveAllocations, getIncomeExpenseSummaryByCurrency, getTotalBalanceByCurrency, getTransactionsForAllocation } from "@/lib/finance-selectors";
import { mockAccounts, mockTransactions } from "@/lib/mock-finance";
import type { WalletAllocation } from "@/types/finance";

describe("finance-selectors", () => {
  it("includes incoming and outgoing goal transactions exactly once", () => {
    const incoming = { ...mockTransactions[0], allocation_id: "goal", source_allocation_id: null };
    const outgoing = { ...mockTransactions[1], allocation_id: null, source_allocation_id: "goal" };
    const both = { ...mockTransactions[2], allocation_id: "goal", source_allocation_id: "goal" };
    const unrelated = { ...mockTransactions[0], allocation_id: "other", source_allocation_id: null };
    expect(getTransactionsForAllocation([incoming, outgoing, both, unrelated], "goal")).toEqual([incoming, outgoing, both]);
  });
  it("groups wallet balances by currency instead of mixing them", () => {
    expect(getTotalBalanceByCurrency(mockAccounts)).toEqual([
      { currency: "EUR", amount: 16400 },
      { currency: "CZK", amount: -174402.88 },
      { currency: "RUB", amount: 64800 },
    ]);
  });

  it("groups income and expenses by transaction currency", () => {
    expect(getIncomeExpenseSummaryByCurrency(mockTransactions)).toEqual([
      { currency: "CZK", income: 678700, expenses: 366838.73 },
    ]);
  });

  describe("getEffectiveAllocations", () => {
    it("returns empty array for empty allocations list", () => {
      expect(getEffectiveAllocations(1000, [])).toEqual([]);
    });

    it("returns allocations unmodified if total is below balance", () => {
      const allocations: WalletAllocation[] = [
        { id: "1", wallet_id: "w1", user_id: "u1", name: "A", amount: 200, created_at: "2026-07-08T10:00:00Z", updated_at: "2026-07-08T10:00:00Z", kind: "goal_open", target_amount: null },
        { id: "2", wallet_id: "w1", user_id: "u1", name: "B", amount: 300, created_at: "2026-07-08T11:00:00Z", updated_at: "2026-07-08T11:00:00Z", kind: "goal_open", target_amount: null }
      ];
      expect(getEffectiveAllocations(1000, allocations)).toEqual(allocations);
    });

    it("reduces/caps allocations from newest to oldest when exceeding balance", () => {
      const allocations: WalletAllocation[] = [
        { id: "1", wallet_id: "w1", user_id: "u1", name: "A", amount: 600, created_at: "2026-07-08T10:00:00Z", updated_at: "2026-07-08T10:00:00Z", kind: "goal_open", target_amount: null },
        { id: "2", wallet_id: "w1", user_id: "u1", name: "B", amount: 300, created_at: "2026-07-08T11:00:00Z", updated_at: "2026-07-08T11:00:00Z", kind: "goal_open", target_amount: null },
        { id: "3", wallet_id: "w1", user_id: "u1", name: "C", amount: 200, created_at: "2026-07-08T12:00:00Z", updated_at: "2026-07-08T12:00:00Z", kind: "goal_open", target_amount: null }
      ];
      // Total = 1100. Balance = 700. Excess = 400.
      // Ordered by newest: C (12:00), B (11:00), A (10:00)
      // C is reduced by min(200, 400) = 200 -> C becomes 0. Remaining excess = 200.
      // B is reduced by min(300, 200) = 200 -> B becomes 100. Remaining excess = 0.
      // A remains 600.
      const expected = [
        { id: "1", wallet_id: "w1", user_id: "u1", name: "A", amount: 600, created_at: "2026-07-08T10:00:00Z", updated_at: "2026-07-08T10:00:00Z", kind: "goal_open", target_amount: null },
        { id: "2", wallet_id: "w1", user_id: "u1", name: "B", amount: 100, created_at: "2026-07-08T11:00:00Z", updated_at: "2026-07-08T11:00:00Z", kind: "goal_open", target_amount: null },
        { id: "3", wallet_id: "w1", user_id: "u1", name: "C", amount: 0, created_at: "2026-07-08T12:00:00Z", updated_at: "2026-07-08T12:00:00Z", kind: "goal_open", target_amount: null }
      ];
      expect(getEffectiveAllocations(700, allocations)).toEqual(expected);
    });
  });
});
