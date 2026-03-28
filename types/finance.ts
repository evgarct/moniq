export type Category = {
  id: string;
  name: string;
};

export type AccountType = "cash" | "saving" | "credit_card" | "debt";
export type DebtKind = "loan" | "mortgage" | "personal";
export type CashKind = "debit_card" | "cash_wallet";
export type AccountGroupType = "cash" | "saving" | "credit_card" | "debt";

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  cash_kind?: CashKind | null;
  debt_kind?: DebtKind | null;
  balance: number;
  currency: string;
  created_at: string;
};

export type Allocation = {
  id: string;
  user_id: string;
  account_id: string;
  name: string;
  amount: number;
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
