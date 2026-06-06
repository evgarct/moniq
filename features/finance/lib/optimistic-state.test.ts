import { describe, expect, it } from "vitest";

import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import {
  applyPaidTransactionEffect,
  removeTransaction,
  setTransactionStatus,
  updateTransaction,
} from "@/features/finance/lib/optimistic-state";
import type { Account, Transaction } from "@/types/finance";

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
});
