import { describe, expect, it } from "vitest";
import { getTransactionDestinationAmount } from "./transaction-effects";
import { applyPaidTransactionEffect } from "@/features/finance/lib/optimistic-state";
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
});
