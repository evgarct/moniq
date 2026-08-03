import { describe, expect, it } from "vitest";

import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import {
  addTransactionEntry,
  adjustWalletBalance,
  applyPaidTransactionEffect,
  createOptimisticId,
  removeTransaction,
  setTransactionStatus,
  updateScheduleNoteFromDate,
  updateTransaction,
} from "@/features/finance/lib/optimistic-state";
import type { Account, Transaction, TransactionSchedule, WalletAllocation } from "@/types/finance";
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
      note: null,
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

  it("rejects a manual balance drop below reserved goals", () => {
    const wallet = { id: "saving-wallet", type: "saving", balance: 1000 } as Account;
    const allocOld = { id: "alloc-old", wallet_id: wallet.id, amount: 400, created_at: "2026-01-01", updated_at: "2026-01-01" } as WalletAllocation;
    const allocNew = { id: "alloc-new", wallet_id: wallet.id, amount: 500, created_at: "2026-02-01", updated_at: "2026-02-01" } as WalletAllocation;
    const snapshot = {
      ...createEmptyFinanceSnapshot(),
      accounts: [wallet],
      allocations: [allocOld, allocNew],
    };

    expect(() => adjustWalletBalance(snapshot, wallet.id, 600)).toThrow(/reserved goals/);
  });

  it("uses Free first and records only the fallback shortfall from the default goal", () => {
    const wallet = { id: "saving-wallet", user_id: "user", type: "saving", balance: 1000, currency: "EUR" } as Account;
    const defaultGoal = {
      id: "default-goal", user_id: "user", wallet_id: wallet.id, name: "Emergency",
      kind: "goal_open", amount: 800, target_amount: null, is_default: true,
      created_at: "2026-01-01", updated_at: "2026-01-01",
    } as WalletAllocation;
    const snapshot = { ...createEmptyFinanceSnapshot(), accounts: [wallet], allocations: [defaultGoal] };

    const next = addTransactionEntry(snapshot, {
      title: "Withdrawal", note: null, occurred_at: "2026-06-06", status: "paid",
      kind: "expense", amount: 350, destination_amount: null, fx_rate: null,
      principal_amount: null, interest_amount: null, extra_principal_amount: null,
      category_id: "cat", source_account_id: wallet.id, destination_account_id: null,
      allocation_id: null, recurrence: null,
    });

    expect(next.accounts[0].balance).toBe(650);
    expect(next.allocations[0].amount).toBe(650);
    const release = next.transactions.find((transaction) => transaction.system_generated);
    expect(release).toMatchObject({
      kind: "transfer",
      amount: 150,
      source_allocation_id: defaultGoal.id,
      source_account_id: wallet.id,
      destination_account_id: wallet.id,
    });

    const parent = next.transactions.find((transaction) => !transaction.system_generated)!;
    const restored = removeTransaction(next, parent.id);
    expect(restored.accounts[0].balance).toBe(1000);
    expect(restored.allocations[0].amount).toBe(800);
    expect(restored.transactions).toHaveLength(0);
  });

  it("rejects fallback when Free plus the default goal is insufficient", () => {
    const wallet = { id: "saving-wallet", user_id: "user", type: "saving", balance: 1000, currency: "EUR" } as Account;
    const defaultGoal = { id: "default", wallet_id: wallet.id, amount: 100, is_default: true } as WalletAllocation;
    const otherGoal = { id: "other", wallet_id: wallet.id, amount: 850, is_default: false } as WalletAllocation;
    const snapshot = { ...createEmptyFinanceSnapshot(), accounts: [wallet], allocations: [defaultGoal, otherGoal] };

    expect(() => addTransactionEntry(snapshot, {
      title: "Too large", note: null, occurred_at: "2026-06-06", status: "paid",
      kind: "expense", amount: 200, destination_amount: null, fx_rate: null,
      principal_amount: null, interest_amount: null, extra_principal_amount: null,
      category_id: "cat", source_account_id: wallet.id, destination_account_id: null,
      allocation_id: null, recurrence: null,
    })).toThrow(/Free plus the default goal/);
  });

  it("updates the schedule note and all future planned occurrences note starting from date", () => {
    const scheduleId = "schedule-123";
    const schedule = { id: scheduleId, note: "Old Note" } as TransactionSchedule;
    const tx1 = { id: "tx-1", schedule_id: scheduleId, occurred_at: "2026-07-10", schedule_occurrence_date: "2026-07-10", status: "planned", note: "Old Note" } as Transaction;
    const tx2 = { id: "tx-2", schedule_id: scheduleId, occurred_at: "2026-07-20", schedule_occurrence_date: "2026-07-20", status: "planned", note: "Old Note" } as Transaction;
    const txPast = { id: "tx-past", schedule_id: scheduleId, occurred_at: "2026-07-05", schedule_occurrence_date: "2026-07-05", status: "paid", note: "Old Note" } as Transaction;
    
    const snapshot = {
      ...createEmptyFinanceSnapshot(),
      schedules: [schedule],
      transactions: [tx1, tx2, txPast],
    };

    const next = updateScheduleNoteFromDate(snapshot, scheduleId, "2026-07-10", "New Super Note");

    const updatedSchedule = next.schedules.find((s) => s.id === scheduleId);
    expect(updatedSchedule?.note).toBe("New Super Note");

    const u1 = next.transactions.find((t) => t.id === "tx-1");
    const u2 = next.transactions.find((t) => t.id === "tx-2");
    const uPast = next.transactions.find((t) => t.id === "tx-past");

    expect(u1?.note).toBe("New Super Note");
    expect(u2?.note).toBe("New Super Note");
    expect(uPast?.note).toBe("Old Note");
  });
});
