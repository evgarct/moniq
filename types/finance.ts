import type { CurrencyCode } from "@/types/currency";

export type CategoryType = "income" | "expense";

export type Category = {
  id: string;
  user_id: string;
  name: string;
  icon: string | null;
  type: CategoryType;
  parent_id: string | null;
  is_system: boolean;
  created_at: string;
};

export type MoneyByCurrency = {
  currency: CurrencyCode;
  amount: number;
};

export type CategoryTreeNode = Category & {
  children: CategoryTreeNode[];
  depth: number;
  total_amount: number;
  totals_by_currency: MoneyByCurrency[];
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
  credit_limit?: number | null;
  currency: CurrencyCode;
  created_at: string;
};

export type TransactionStatus = "planned" | "paid" | "skipped";
export type TransactionKind = "income" | "expense" | "transfer" | "debt_payment";
export type TransactionScheduleFrequency = "daily" | "weekly" | "monthly";
export type TransactionScheduleState = "active" | "paused";

export type TransactionSchedule = {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  start_date: string;
  frequency: TransactionScheduleFrequency;
  until_date: string | null;
  state: TransactionScheduleState;
  kind: TransactionKind;
  amount: number;
  destination_amount: number | null;
  fx_rate: number | null;
  principal_amount: number | null;
  interest_amount: number | null;
  extra_principal_amount: number | null;
  category_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  category: Category | null;
  source_account: Account | null;
  destination_account: Account | null;
  validation_error: string | null;
  created_at: string;
  updated_at: string;
};

export type Transaction = {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  occurred_at: string;
  created_at: string;
  status: TransactionStatus;
  kind: TransactionKind;
  amount: number;
  destination_amount: number | null;
  fx_rate: number | null;
  principal_amount: number | null;
  interest_amount: number | null;
  extra_principal_amount: number | null;
  category_id: string | null;
  source_account_id: string | null;
  destination_account_id: string | null;
  schedule_id: string | null;
  schedule_occurrence_date: string | null;
  is_schedule_override: boolean;
  category: Category | null;
  source_account: Account | null;
  destination_account: Account | null;
  schedule: TransactionSchedule | null;
};

export type FinanceSnapshot = {
  accounts: Account[];
  categories: Category[];
  schedules: TransactionSchedule[];
  transactions: Transaction[];
};
