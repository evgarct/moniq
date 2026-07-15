import type { CurrencyCode } from "@/types/currency";

export type CategoryType = "income" | "expense";
export type CategoryPurpose = "investment";

export type Category = {
  id: string;
  user_id: string;
  name: string;
  description?: string | null;
  icon: string | null;
  type: CategoryType;
  parent_id: string | null;
  is_system: boolean;
  purpose?: CategoryPurpose | null;
  created_at: string;
  sync_version?: number;
};

export type MoneyByCurrency = {
  currency: CurrencyCode;
  amount: number;
};

export type DefaultCurrencySource = "saved" | "wallet_inferred" | "fallback";

export type UserPreferences = {
  default_currency: CurrencyCode;
  default_currency_source: DefaultCurrencySource;
  sync_version?: number;
};

export type ExchangeRateProvider = "frankfurter" | "currency-api";

export type ExchangeRate = {
  provider: ExchangeRateProvider;
  base_currency: CurrencyCode;
  quote_currency: CurrencyCode;
  requested_date: string;
  rate_date: string;
  rate: number;
  fetched_at: string;
};

export type InvestmentInstrumentType = "stock" | "etf";

export type InvestmentInstrument = {
  id: string;
  name: string;
  type: InvestmentInstrumentType;
  ticker: string;
  exchange: string;
  quote_currency: CurrencyCode;
  isin: string | null;
  provider: string;
  provider_symbol: string;
};

export type InvestmentInstrumentCandidate = Omit<InvestmentInstrument, "id"> & {
  id?: string;
};

export type InvestmentQuote = {
  instrument_id: string;
  provider: string;
  market_date: string;
  price: number;
  currency: CurrencyCode;
  fetched_at: string;
};

export type InvestmentPosition = {
  id: string;
  user_id: string;
  instrument_id: string;
  opening_units: number;
  created_at: string;
  updated_at: string;
  instrument: InvestmentInstrument;
  latest_quote: InvestmentQuote | null;
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
  sync_version?: number;
};

export type TransactionStatus = "planned" | "paid" | "skipped";
export type TransactionKind = "income" | "expense" | "transfer" | "debt_payment";
export type TransactionScheduleFrequency = "daily" | "weekly" | "monthly" | "quarterly" | "yearly";
export type TransactionScheduleState = "active" | "paused";

export type TransactionSchedule = {
  id: string;
  user_id: string;
  title: string;
  note: string | null;
  start_date: string;
  frequency: TransactionScheduleFrequency;
  interval_weeks: number;
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
  allocation_id: string | null;
  allocation: WalletAllocation | null;
  validation_error: string | null;
  created_at: string;
  updated_at: string;
  sync_version?: number;
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
  allocation_id: string | null;
  allocation: WalletAllocation | null;
  investment_instrument_id?: string | null;
  investment_units?: number | null;
  investment_instrument?: InvestmentInstrument | null;
  sync_version?: number;
};

export type WalletAllocationKind = "goal_open" | "goal_targeted";

export type WalletAllocation = {
  id: string;
  user_id: string;
  wallet_id: string;
  name: string;
  kind: WalletAllocationKind;
  amount: number;
  target_amount: number | null;
  created_at: string;
  updated_at: string;
  sync_version?: number;
};

export type FinanceSnapshot = {
  accounts: Account[];
  categories: Category[];
  schedules: TransactionSchedule[];
  transactions: Transaction[];
  allocations: WalletAllocation[];
  preferences: UserPreferences;
  exchange_rates: ExchangeRate[];
  investment_positions: InvestmentPosition[];
};
