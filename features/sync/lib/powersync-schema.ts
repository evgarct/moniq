import { column, Schema, Table } from "@powersync/web";

const localSnapshots = new Table(
  {
    user_id: column.text,
    payload: column.text,
    saved_at: column.text,
  },
  { localOnly: true },
);

const localAuthLease = new Table(
  {
    user_id: column.text,
    verified_at: column.text,
  },
  { localOnly: true },
);

const localSyncCommands = new Table(
  {
    user_id: column.text,
    payload: column.text,
    status: column.text,
    created_at: column.text,
    updated_at: column.text,
    result: column.text,
  },
  { localOnly: true },
);

const wallets = new Table({
  user_id: column.text,
  name: column.text,
  type: column.text,
  cash_kind: column.text,
  debt_kind: column.text,
  balance: column.real,
  credit_limit: column.real,
  currency: column.text,
  created_at: column.text,
  updated_at: column.text,
  sync_version: column.integer,
});

const walletAllocations = new Table({
  user_id: column.text,
  wallet_id: column.text,
  name: column.text,
  kind: column.text,
  amount: column.real,
  target_amount: column.real,
  created_at: column.text,
  updated_at: column.text,
  sync_version: column.integer,
});

const categories = new Table({
  user_id: column.text,
  name: column.text,
  description: column.text,
  icon: column.text,
  type: column.text,
  parent_id: column.text,
  is_system: column.integer,
  purpose: column.text,
  created_at: column.text,
  updated_at: column.text,
  sync_version: column.integer,
});

const transactions = new Table({
  user_id: column.text,
  title: column.text,
  note: column.text,
  occurred_at: column.text,
  created_at: column.text,
  updated_at: column.text,
  status: column.text,
  kind: column.text,
  amount: column.real,
  destination_amount: column.real,
  fx_rate: column.real,
  principal_amount: column.real,
  interest_amount: column.real,
  extra_principal_amount: column.real,
  category_id: column.text,
  source_account_id: column.text,
  destination_account_id: column.text,
  schedule_id: column.text,
  schedule_occurrence_date: column.text,
  is_schedule_override: column.integer,
  allocation_id: column.text,
  investment_instrument_id: column.text,
  investment_units: column.real,
  sync_version: column.integer,
});

const schedules = new Table({
  user_id: column.text,
  title: column.text,
  note: column.text,
  start_date: column.text,
  frequency: column.text,
  interval_weeks: column.integer,
  until_date: column.text,
  state: column.text,
  kind: column.text,
  amount: column.real,
  destination_amount: column.real,
  fx_rate: column.real,
  principal_amount: column.real,
  interest_amount: column.real,
  extra_principal_amount: column.real,
  category_id: column.text,
  source_account_id: column.text,
  destination_account_id: column.text,
  allocation_id: column.text,
  created_at: column.text,
  updated_at: column.text,
  sync_version: column.integer,
});

const preferences = new Table({
  user_id: column.text,
  default_currency: column.text,
  updated_at: column.text,
  sync_version: column.integer,
});

const exchangeRates = new Table({
  provider: column.text,
  base_currency: column.text,
  quote_currency: column.text,
  requested_date: column.text,
  rate_date: column.text,
  rate: column.real,
  fetched_at: column.text,
});

const investmentPositions = new Table({
  user_id: column.text,
  instrument_id: column.text,
  opening_units: column.real,
  created_at: column.text,
  updated_at: column.text,
});

const investmentInstruments = new Table({
  name: column.text,
  type: column.text,
  ticker: column.text,
  exchange: column.text,
  quote_currency: column.text,
  isin: column.text,
  provider: column.text,
  provider_symbol: column.text,
});

const investmentQuotes = new Table({
  instrument_id: column.text,
  provider: column.text,
  market_date: column.text,
  price: column.real,
  currency: column.text,
  fetched_at: column.text,
});

export const moniqPowerSyncSchema = new Schema({
  local_snapshots: localSnapshots,
  local_auth_lease: localAuthLease,
  local_sync_commands: localSyncCommands,
  wallets,
  wallet_allocations: walletAllocations,
  finance_categories: categories,
  finance_transactions: transactions,
  finance_transaction_schedules: schedules,
  user_preferences: preferences,
  fx_rates: exchangeRates,
  investment_positions: investmentPositions,
  investment_instruments: investmentInstruments,
  investment_quotes: investmentQuotes,
});

export const POWER_SYNCED_TABLES = [
  "wallets",
  "wallet_allocations",
  "finance_categories",
  "finance_transactions",
  "finance_transaction_schedules",
  "user_preferences",
  "fx_rates",
  "investment_positions",
  "investment_instruments",
  "investment_quotes",
] as const;
