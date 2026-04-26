import { normalizeCurrencyCode } from "@/lib/currencies";
import { createClientId } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";
import type { Account, CashKind, DebtKind, Transaction } from "@/types/finance";

export type AccountDraftValues = {
  name: string;
  type: Account["type"];
  balance: number;
  credit_limit?: number | null;
  currency: CurrencyCode;
  debt_kind?: DebtKind | null;
};

export type AccountStateSnapshot = {
  accounts: Account[];
  transactions: Transaction[];
};

type IdFactory = (prefix: string) => string;

type CreateAccountOptions = {
  values: AccountDraftValues;
  userId: string;
  now?: string;
  idFactory?: IdFactory;
};

type SaveAccountOptions = {
  snapshot: AccountStateSnapshot;
  values: AccountDraftValues;
  userId: string;
  mode: "add" | "edit";
  editingAccount?: Account | null;
  now?: string;
  idFactory?: IdFactory;
};

export function normalizeAccountBalance(type: Account["type"], balance: number) {
  return type === "credit_card" || type === "debt" ? -Math.abs(balance) : Math.abs(balance);
}

export function normalizeCreditLimit(type: Account["type"], creditLimit?: number | null) {
  if (type !== "credit_card") {
    return null;
  }

  return creditLimit == null ? null : Math.abs(creditLimit);
}

export function getDefaultCashKind(type: Account["type"], current?: CashKind | null) {
  if (type !== "cash") {
    return null;
  }

  return current ?? "debit_card";
}

export function getDefaultDebtKind(type: Account["type"], current?: DebtKind | null, next?: DebtKind | null) {
  if (type !== "debt") {
    return null;
  }

  return next ?? current ?? "personal";
}

export function validateAccountValues(values: AccountDraftValues) {
  if (values.type === "credit_card") {
    if (values.credit_limit == null || values.credit_limit <= 0) {
      throw new Error("Credit limit is required for a credit card.");
    }

    if (Math.abs(values.balance) - values.credit_limit > 0.01) {
      throw new Error("Current balance cannot exceed the credit limit.");
    }
  }
}

export function createAccount({
  values,
  userId,
  now = new Date().toISOString(),
  idFactory = createClientId,
}: CreateAccountOptions): Account {
  validateAccountValues(values);

  return {
    id: idFactory("wallet"),
    user_id: userId,
    name: values.name,
    type: values.type,
    balance: normalizeAccountBalance(values.type, values.balance),
    credit_limit: normalizeCreditLimit(values.type, values.credit_limit),
    currency: normalizeCurrencyCode(values.currency),
    created_at: now,
    cash_kind: getDefaultCashKind(values.type),
    debt_kind: getDefaultDebtKind(values.type, null, values.debt_kind),
  };
}

export function updateAccount(account: Account, values: AccountDraftValues): Account {
  validateAccountValues(values);

  return {
    ...account,
    name: values.name,
    type: values.type,
    balance: normalizeAccountBalance(values.type, values.balance),
    credit_limit: normalizeCreditLimit(values.type, values.credit_limit),
    currency: normalizeCurrencyCode(values.currency),
    cash_kind: getDefaultCashKind(values.type, account.cash_kind ?? null),
    debt_kind: getDefaultDebtKind(values.type, account.debt_kind ?? null, values.debt_kind),
  };
}

export function saveAccount({
  snapshot,
  values,
  userId,
  mode,
  editingAccount,
  now,
  idFactory,
}: SaveAccountOptions): { snapshot: AccountStateSnapshot; account: Account } {
  if (mode === "edit") {
    if (!editingAccount) {
      throw new Error("Editing account is required in edit mode.");
    }

    const nextAccount = updateAccount(editingAccount, values);
    const nextAccounts = snapshot.accounts.map((account) => (account.id === nextAccount.id ? nextAccount : account));
    const nextTransactions = snapshot.transactions.map((transaction) => ({
        ...transaction,
        source_account: transaction.source_account_id === nextAccount.id ? nextAccount : transaction.source_account,
        destination_account:
          transaction.destination_account_id === nextAccount.id ? nextAccount : transaction.destination_account,
      }));

    return {
      snapshot: {
        accounts: nextAccounts,
        transactions: nextTransactions,
      },
      account: nextAccount,
    };
  }

  const createdAccount = createAccount({
    values,
    userId,
    now,
    idFactory,
  });

  return {
    snapshot: {
      accounts: [createdAccount, ...snapshot.accounts],
      transactions: snapshot.transactions,
    },
    account: createdAccount,
  };
}

export function deleteAccount(snapshot: AccountStateSnapshot, accountId: string): AccountStateSnapshot {
  return {
    accounts: snapshot.accounts.filter((account) => account.id !== accountId),
    transactions: snapshot.transactions.filter(
      (transaction) => transaction.source_account_id !== accountId && transaction.destination_account_id !== accountId,
    ),
  };
}
