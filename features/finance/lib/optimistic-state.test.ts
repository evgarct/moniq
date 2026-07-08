import { describe, expect, it } from "vitest";

import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import {
  addTransactionEntry,
  adjustWalletBalance,
  applyPaidTransactionEffect,
  createOptimisticId,
  removeTransaction,
  setTransactionStatus,
  updateTransaction,
} from "@/features/finance/lib/optimistic-state";
import type { Account, Transaction, WalletAllocation } from "@/types/finance";
import type { TransactionEntryInput } from "@/types/finance-schemas";

const source = { id: "source", balance: 1000 } as Account;
const destination = { id: "destination", balance: 200 } as Account;
const paidTransfer = {
  id: "tx",
  status: "paid",
  amount: 100,
  destination_amount: 90,
  source_account_id: source.id,
  destination_account_id: destination.id,
} as Transaction;

describe("optimistic finance state", () => {
  it("uses persistent UUIDs for offline relationships", () => {
    expect(createOptimisticId("wallet")).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  });

  it("keeps caller-provided optimistic transaction IDs stable", () => {
    const snapshot = {
      ...createEmptyFinanceSnapshot(),
      accounts: [source],
      categories: [{ id: "category" } as never],
    };
    const next = addTransactionEntry(
      snapshot,
      {
        title: "Planned expense",
        note: null,
        occurred_at: "2026-06-06",
        status: "planned",
        kind: "expense",
        amount: 25,
        destination_amount: null,
        fx_rate: null,
        principal_amount: null,
        interest_amount: null,
        extra_principal_amount: null,
        category_id: "category",
        source_account_id: "source",
        destination_account_id: null,
        allocation_id: null,
        recurrence: null,
      } satisfies TransactionEntryInput,
      ["optimistic:transaction:stable"],
    );

    expect(next.transactions[0]?.id).toBe("optimistic:transaction:stable");
  });

  it("mirrors the paid transaction balance trigger", () => {
    const accounts = applyPaidTransactionEffect([source, destination], paidTransfer, 1);
    expect(accounts.find((account) => account.id === source.id)?.balance).toBe(900);
    expect(accounts.find((account) => account.id === destination.id)?.balance).toBe(290);
  });

  it("marks a planned transaction paid and updates both balances", () => {
    const snapshot = {
      ...createEmptyFinanceSnapshot(),
      accounts: [source, destination],
      transactions: [{ ...paidTransfer, status: "planned" as const }],
    };
    const next = setTransactionStatus(snapshot, paidTransfer.id, "paid");
    expect(next.accounts.map((account) => account.balance)).toEqual([900, 290]);
  });

  it("reverses balances when deleting a paid transaction", () => {
    const snapshot = {
      ...createEmptyFinanceSnapshot(),
      accounts: [{ ...source, balance: 900 }, { ...destination, balance: 290 }],
      transactions: [paidTransfer],
    };
    const next = removeTransaction(snapshot, paidTransfer.id);
    expect(next.accounts.map((account) => account.balance)).toEqual([1000, 200]);
  });

  it("reverses the old effect before applying an update", () => {
    const snapshot = {
      ...createEmptyFinanceSnapshot(),
      accounts: [{ ...source, balance: 900 }, { ...destination, balance: 290 }],
      transactions: [paidTransfer],
    };
    const next = updateTransaction(snapshot, paidTransfer.id, {
      title: "Transfer",
      occurred_at: "2026-06-06",
      status: "paid",
      kind: "transfer",
      amount: 50,
      destination_amount: 45,
      source_account_id: source.id,
      destination_account_id: destination.id,
      category_id: null,
      allocation_id: null,
      note: null,
      fx_rate: null,
      principal_amount: null,
      interest_amount: null,
      extra_principal_amount: null,
    });
    expect(next.accounts.map((account) => account.balance)).toEqual([950, 245]);
  });

  it("decreases allocation amount when a paid expense is added", () => {
    const wallet = { id: "saving-wallet", type: "saving", balance: 1000 } as Account;
    const allocation = { id: "alloc-1", wallet_id: wallet.id, amount: 400 } as WalletAllocation;
    const snapshot = {
      ...createEmptyFinanceSnapshot(),
      accounts: [wallet],
      allocations: [allocation],
    };
    
    // Add a paid expense transaction of 150 linked to alloc-1
    const next = addTransactionEntry(snapshot, {
      title: "Spent on goal",
      occurred_at: "2026-06-06",
      status: "paid",
      kind: "expense",
      amount: 150,
      destination_amount: null,
      fx_rate: null,
      principal_amount: null,
      interest_amount: null,
      extra_principal_amount: null,
      category_id: "cat",
      source_account_id: wallet.id,
      destination_account_id: null,
      allocation_id: allocation.id,
      recurrence: null,
    });

    const nextWallet = next.accounts.find((a) => a.id === wallet.id);
    const nextAlloc = next.allocations.find((a) => a.id === allocation.id);
    expect(nextWallet?.balance).toBe(850);
    expect(nextAlloc?.amount).toBe(250); // 400 - 150
  });

  it("restores allocation amount when a paid expense is deleted", () => {
    const wallet = { id: "saving-wallet", type: "saving", balance: 850 } as Account;
    const allocation = { id: "alloc-1", wallet_id: wallet.id, amount: 250 } as WalletAllocation;
    const paidExpense = {
      id: "tx-expense",
      status: "paid",
      kind: "expense",
      amount: 150,
      source_account_id: wallet.id,
      allocation_id: allocation.id,
    } as Transaction;

    const snapshot = {
      ...createEmptyFinanceSnapshot(),
      accounts: [wallet],
      allocations: [allocation],
      transactions: [paidExpense],
    };

    const next = removeTransaction(snapshot, paidExpense.id);
    const nextWallet = next.accounts.find((a) => a.id === wallet.id);
    const nextAlloc = next.allocations.find((a) => a.id === allocation.id);
    expect(nextWallet?.balance).toBe(1000);
    expect(nextAlloc?.amount).toBe(400); // 250 + 150
  });

  it("caps allocations from newest to oldest when wallet balance drops below total allocated", () => {
    const wallet = { id: "saving-wallet", type: "saving", balance: 1000 } as Account;
    const allocOld = { id: "alloc-old", wallet_id: wallet.id, amount: 400, created_at: "2026-01-01", updated_at: "2026-01-01" } as WalletAllocation;
    const allocNew = { id: "alloc-new", wallet_id: wallet.id, amount: 500, created_at: "2026-02-01", updated_at: "2026-02-01" } as WalletAllocation;
    const snapshot = {
      ...createEmptyFinanceSnapshot(),
      accounts: [wallet],
      allocations: [allocOld, allocNew],
    };

    // Wallet balance drops to 600. Excess = 900 - 600 = 300.
    // allocNew is newer, so it should be reduced by 300 (down to 200).
    const next = adjustWalletBalance(snapshot, wallet.id, 600);
    
    const nextOld = next.allocations.find((a) => a.id === allocOld.id);
    const nextNew = next.allocations.find((a) => a.id === allocNew.id);
    expect(nextOld?.amount).toBe(400);
    expect(nextNew?.amount).toBe(200);
  });
});
