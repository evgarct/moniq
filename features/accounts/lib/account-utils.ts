import type { Account, AccountGroupType, AccountType } from "@/types/finance";

const accountGroupMap: Record<AccountType, AccountGroupType> = {
  cash: "cash",
  saving: "saving",
  credit_card: "credit_card",
  debt: "debt",
};

export function getAccountGroup(type: AccountType): AccountGroupType {
  return accountGroupMap[type];
}

export function isSavingsAccount(account: Account) {
  return account.type === "saving";
}

export function isDebtAccount(account: Account) {
  return account.type === "debt";
}

export function isCreditCardAccount(account: Account) {
  return account.type === "credit_card";
}

export function getCreditCardMetrics(account: Account) {
  const limit = Math.max(account.credit_limit ?? Math.abs(account.balance), 0);
  const debt = Math.abs(account.balance);
  const available = Math.max(limit - debt, 0);
  const usage = limit > 0 ? Math.min(debt / limit, 1) : 0;

  return {
    limit,
    debt,
    available,
    usage,
  };
}

export function getNetWorthTotal(accounts: Account[]) {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

export function getAccountTypeLabel(type: AccountType) {
  if (type === "cash") {
    return "Cash";
  }

  if (type === "saving") {
    return "Saving";
  }

  if (type === "credit_card") {
    return "Credit Card";
  }

  return "Debt";
}
