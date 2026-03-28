export type Category = {
  id: string;
  name: string;
};

export type AccountType = "checking" | "savings" | "cash";

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
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
  categories: Category[];
  transactions: Transaction[];
};
