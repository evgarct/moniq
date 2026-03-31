import { describe, expect, it } from "vitest";

import { deleteAccount, normalizeAccountBalance, saveAccount } from "@/features/accounts/lib/account-state";
import type { Account, Allocation, Category, Transaction } from "@/types/finance";

const baseCategory: Category = {
  id: "cafe",
  user_id: "user-1",
  name: "Cafe",
  icon: "☕",
  type: "expense",
  parent_id: null,
  created_at: "2026-03-28T10:00:00.000Z",
};

const incomeCategory: Category = {
  id: "salary",
  user_id: "user-1",
  name: "Salary",
  icon: "💼",
  type: "income",
  parent_id: null,
  created_at: "2026-03-28T10:00:00.000Z",
};

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
    kind: "goal_open",
    amount: 600,
    target_amount: null,
    created_at: "2026-03-28T10:00:00.000Z",
  },
];

const transactions: Transaction[] = [
  {
    id: "tx-1",
    user_id: "user-1",
    title: "Coffee",
    note: null,
    occurred_at: "2026-03-28",
    created_at: "2026-03-28T10:00:00.000Z",
    status: "paid",
    kind: "expense",
    amount: 6,
    destination_amount: null,
    fx_rate: null,
    principal_amount: null,
    interest_amount: null,
    extra_principal_amount: null,
    category_id: "cafe",
    source_account_id: "wallet-2",
    destination_account_id: null,
    allocation_id: null,
    schedule_id: null,
    schedule_occurrence_date: null,
    is_schedule_override: false,
    category: baseCategory,
    source_account: savingAccount,
    destination_account: null,
    allocation: null,
    schedule: null,
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

  it("updates the wallet currency and keeps linked transactions in sync", () => {
    const result = saveAccount({
      snapshot: {
        accounts: [baseAccount],
        allocations: [],
        transactions: [
          {
            id: "tx-2",
            user_id: "user-1",
            title: "Salary",
            note: null,
            occurred_at: "2026-03-29",
            created_at: "2026-03-29T10:00:00.000Z",
            status: "paid",
            kind: "income",
            amount: 1000,
            destination_amount: null,
            fx_rate: null,
            principal_amount: null,
            interest_amount: null,
            extra_principal_amount: null,
            category_id: "salary",
            source_account_id: null,
            destination_account_id: "wallet-1",
            allocation_id: null,
            schedule_id: null,
            schedule_occurrence_date: null,
            is_schedule_override: false,
            category: incomeCategory,
            source_account: null,
            destination_account: baseAccount,
            allocation: null,
            schedule: null,
          },
        ],
      },
      values: {
        name: "Main Cash CZK",
        type: "cash",
        balance: 3000,
        currency: "CZK",
      },
      userId: "user-1",
      mode: "edit",
      editingAccount: baseAccount,
    });

    expect(result.account.currency).toBe("CZK");
    expect(result.snapshot.transactions[0]?.destination_account?.currency).toBe("CZK");
  });

  it("updates linked transactions and removes saving allocations when a saving wallet changes type", () => {
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
    expect(result.snapshot.transactions[0]?.source_account?.type).toBe("credit_card");
    expect(result.snapshot.transactions[0]?.source_account?.name).toBe("Emergency Card");
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
