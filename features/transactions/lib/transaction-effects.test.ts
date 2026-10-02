import { describe, expect, it } from "vitest";
import { getTransactionDestinationAmount } from "./transaction-effects";
import { addTransaction, applyPaidTransactionEffect, removeTransaction, setTransactionStatus, updateTransaction } from "@/features/finance/lib/optimistic-state";
import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import type { TransactionInput } from "@/types/finance-schemas";
import type { Account, Transaction } from "@/types/finance";

describe("debt ledger effects", () => {
  it.each([
    [31700, 19975.5, 11724.5, 0, 19975.5],
    [100, 0, 100, 0, 0],
    [5000, 0, 0, 5000, 5000],
    [12000, 12000, 0, 0, 12000],
  ])("applies and reverses amount %s exactly", (amount, principal, interest, extra, expected) => {
    const tx = { kind: "debt_payment", status: "paid", amount, principal_amount: principal, interest_amount: interest, extra_principal_amount: extra, destination_amount: amount, source_account_id: "cash", destination_account_id: "debt" } as Transaction;
    const accounts = [{ id: "cash", balance: 50000 }, { id: "debt", balance: -100000 }] as Account[];
    expect(getTransactionDestinationAmount(tx)).toBe(expected);
    const paid = applyPaidTransactionEffect(accounts, tx, 1);
    expect(paid.map(a => a.balance)).toEqual([50000 - amount, -100000 + expected]);
    expect(applyPaidTransactionEffect(paid, tx, -1)).toEqual(accounts);
    expect(applyPaidTransactionEffect(accounts, { ...tx, status: "planned" }, 1)).toEqual(accounts);
  });

  it.each(["debt", "credit_card"])("reverses create/edit/status/delete for %s", (type) => {
    const snapshot = { ...createEmptyFinanceSnapshot(), accounts: [{ id: "cash", type: "cash", balance: 50000 }, { id: "debt", type, balance: -100000 }] as Account[] };
    const values = { title: "Payment", occurred_at: "2026-10-02", status: "paid", kind: "debt_payment", amount: 31700, principal_amount: 19975.5, interest_amount: 11724.5, extra_principal_amount: 0, source_account_id: "cash", destination_account_id: "debt" } as TransactionInput;
    const created = addTransaction(snapshot, values, "payment");
    expect(created.accounts.map(a => a.balance)).toEqual([18300, -80024.5]);
    const edited = updateTransaction(created, "payment", { ...values, amount: 100, principal_amount: 0, interest_amount: 100 });
    expect(edited.accounts.map(a => a.balance)).toEqual([49900, -100000]);
    const planned = setTransactionStatus(edited, "payment", "planned");
    expect(planned.accounts.map(a => a.balance)).toEqual([50000, -100000]);
    const paidAgain = setTransactionStatus(planned, "payment", "paid");
    expect(paidAgain.accounts.map(a => a.balance)).toEqual([49900, -100000]);
    expect(removeTransaction(paidAgain, "payment").accounts.map(a => a.balance)).toEqual([50000, -100000]);
  });

  it("reverses the recorded historical effect and retains it for a note edit", () => {
    const legacy = { id: "legacy", title: "Payment", status: "paid", kind: "debt_payment", amount: 1000, destination_amount: null, principal_amount: 800, interest_amount: 200, extra_principal_amount: 0, posted_destination_amount: 1000, source_account_id: "cash", destination_account_id: "debt" } as Transaction;
    const snapshot = { ...createEmptyFinanceSnapshot(), accounts: [{ id: "cash", balance: 49000 }, { id: "debt", balance: -99000 }] as Account[], transactions: [legacy] };
    const noteOnly = updateTransaction(snapshot, "legacy", { ...legacy, note: "Bank details" } as TransactionInput);
    expect(noteOnly.accounts.map(a => a.balance)).toEqual([49000, -99000]);
    expect(removeTransaction(noteOnly, "legacy").accounts.map(a => a.balance)).toEqual([50000, -100000]);
    const financialEdit = updateTransaction(snapshot, "legacy", { ...legacy, amount: 1500, principal_amount: 1300 } as TransactionInput);
    expect(financialEdit.accounts.map(a => a.balance)).toEqual([48500, -98700]);
    expect(financialEdit.transactions[0].posted_destination_amount).toBe(1300);
  });
});
