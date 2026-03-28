import { describe, expect, it } from "vitest";

import { deleteAccount, normalizeAccountBalance, saveAccount } from "@/features/accounts/lib/account-state";
import type { Account, Allocation, Transaction } from "@/types/finance";

const baseAccount: Account = {
  id: "wallet-1",
  user_id: "user-1",
  name: "Main Cash",
  type: "cash",
  cash_kind: "debit_card",
  debt_kind: null,
  balance: 2400,
  currency: "USD",
  created_at: "2026-03-28T10:00:00.000Z",
};

const savingAccount: Account = {
  id: "wallet-2",
  user_id: "user-1",
  name: "Emergency",
  type: "saving",
  cash_kind: null,
  debt_kind: null,
  balance: 5000,
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

const transactions: Transaction[] = [
  {
    id: "tx-1",
    title: "Coffee",
    amount: -6,
    date: "2026-03-28",
    category: { id: "cafe", name: "Cafe" },
    account: savingAccount,
    status: "paid",
    type: "expense",
  },
];

describe("account-state", () => {
  it("normalizes liability balances as negative values", () => {
    expect(normalizeAccountBalance("cash", -120)).toBe(120);
    expect(normalizeAccountBalance("saving", -120)).toBe(120);
    expect(normalizeAccountBalance("credit_card", 120)).toBe(-120);
    expect(normalizeAccountBalance("debt", 120)).toBe(-120);
  });

  it("creates a new wallet with normalized shape", () => {
    const result = saveAccount({
      snapshot: { accounts: [baseAccount], allocations: [], transactions: [] },
      values: {
        name: "Travel",
        type: "debt",
        balance: 1500,
        currency: "EUR",
        debt_kind: "loan",
      },
      userId: "user-1",
      mode: "add",
      now: "2026-03-28T12:00:00.000Z",
      idFactory: (prefix) => `${prefix}-fixed`,
    });

    expect(result.account).toMatchObject({
      id: "wallet-fixed",
      name: "Travel",
      type: "debt",
      balance: -1500,
      currency: "EUR",
      debt_kind: "loan",
      cash_kind: null,
    });
    expect(result.snapshot.accounts[0]?.id).toBe("wallet-fixed");
  });

  it("updates transactions and removes saving allocations when a saving wallet changes type", () => {
    const result = saveAccount({
      snapshot: {
        accounts: [baseAccount, savingAccount],
        allocations,
        transactions,
      },
      values: {
        name: "Emergency Card",
        type: "credit_card",
        balance: 700,
        currency: "USD",
      },
      userId: "user-1",
      mode: "edit",
      editingAccount: savingAccount,
    });

    expect(result.account.type).toBe("credit_card");
    expect(result.account.balance).toBe(-700);
    expect(result.snapshot.allocations).toHaveLength(0);
    expect(result.snapshot.transactions[0]?.account.type).toBe("credit_card");
    expect(result.snapshot.transactions[0]?.account.name).toBe("Emergency Card");
  });

  it("deletes a wallet together with related transactions and allocations", () => {
    const result = deleteAccount(
      {
        accounts: [baseAccount, savingAccount],
        allocations,
        transactions,
      },
      "wallet-2",
    );

    expect(result.accounts).toEqual([baseAccount]);
    expect(result.allocations).toEqual([]);
    expect(result.transactions).toEqual([]);
  });
});
