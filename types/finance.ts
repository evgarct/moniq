import type { CurrencyCode } from "@/types/currency";

export type Category = {
  id: string;
  name: string;
};

export type AccountType = "cash" | "saving" | "credit_card" | "debt";
export type DebtKind = "loan" | "mortgage" | "personal";
export type CashKind = "debit_card" | "cash_wallet";
export type AccountGroupType = "cash" | "saving" | "credit_card" | "debt";
export type AllocationKind = "goal_open" | "goal_targeted";

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  cash_kind?: CashKind | null;
  debt_kind?: DebtKind | null;
  balance: number;
  currency: CurrencyCode;
  created_at: string;
};

export type Allocation = {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  kind: AllocationKind;
  amount: number;
  target_amount: number | null;
  created_at: string;
};

export type TransactionStatus = "planned" | "paid";
export type TransactionType = "income" | "expense";

export type Transaction = {
  id: string;
  title: string;
  amount: number;
  date: string;
  category: Category;
  account: Account;
  status: TransactionStatus;
  type: TransactionType;
};

export type FinanceSnapshot = {
  accounts: Account[];
  allocations: Allocation[];
  categories: Category[];
  transactions: Transaction[];
};
