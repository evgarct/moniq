export type Category = {
  id: string;
  name: string;
};

export type AccountType = "checking" | "savings" | "credit_card" | "loan" | "mortgage";
export type AccountGroupType = "available_money" | "debt";

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
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
