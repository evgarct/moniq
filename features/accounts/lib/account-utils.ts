import type { Account, AccountGroupType, AccountType } from "@/types/finance";

const accountGroupMap: Record<AccountType, AccountGroupType> = {
  checking: "available_money",
  savings: "available_money",
  credit_card: "debt",
  loan: "debt",
  mortgage: "debt",
};

export function getAccountGroup(type: AccountType): AccountGroupType {
  return accountGroupMap[type];
}

export function isSavingsAccount(account: Account) {
  return account.type === "savings";
}

export function isDebtAccount(account: Account) {
  return getAccountGroup(account.type) === "debt";
}

export function getNetWorthTotal(accounts: Account[]) {
  return accounts.reduce((sum, account) => sum + account.balance, 0);
}

export function getAccountTypeLabel(type: AccountType) {
  return type.replace("_", " ");
}
