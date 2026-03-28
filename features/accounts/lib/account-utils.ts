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
