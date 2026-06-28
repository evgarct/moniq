import type { AbstractPowerSyncDatabase } from "@powersync/web";

import { createEmptyFinanceSnapshot } from "@/features/finance/lib/empty-snapshot";
import { resolveUserPreferences } from "@/features/finance/lib/preferences";
import type {
  Account,
  Category,
  ExchangeRate,
  FinanceSnapshot,
  InvestmentInstrument,
  InvestmentPosition,
  InvestmentQuote,
  Transaction,
  TransactionSchedule,
  WalletAllocation,
} from "@/types/finance";
import type { CurrencyCode } from "@/types/currency";

const SNAPSHOT_ID = "current";
const LEASE_ID = "current";
export const OFFLINE_AUTH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

export async function readCachedFinanceSnapshot(db: AbstractPowerSyncDatabase, userId: string) {
  const row = await db.getOptional<{ payload: string }>(
    "select payload from local_snapshots where id = ? and user_id = ?",
    [SNAPSHOT_ID, userId],
  );
  if (!row?.payload) return null;
  try {
    return JSON.parse(row.payload) as FinanceSnapshot;
  } catch {
    return null;
  }
}

export async function writeCachedFinanceSnapshot(
  db: AbstractPowerSyncDatabase,
  userId: string,
  snapshot: FinanceSnapshot,
) {
  await db.execute(
    `insert or replace into local_snapshots(id, user_id, payload, saved_at) values (?, ?, ?, ?)`,
    [SNAPSHOT_ID, userId, JSON.stringify(snapshot), new Date().toISOString()],
  );
}

export async function markOnlineAuthVerified(db: AbstractPowerSyncDatabase, userId: string) {
  await db.execute(
    `insert or replace into local_auth_lease(id, user_id, verified_at) values (?, ?, ?)`,
    [LEASE_ID, userId, new Date().toISOString()],
  );
}

export async function hasValidOfflineAuthLease(db: AbstractPowerSyncDatabase, userId: string, now = Date.now()) {
  const row = await db.getOptional<{ verified_at: string }>(
    "select verified_at from local_auth_lease where id = ? and user_id = ?",
    [LEASE_ID, userId],
  );
  if (!row) return false;
  const verifiedAt = Date.parse(row.verified_at);
  return Number.isFinite(verifiedAt) && now - verifiedAt <= OFFLINE_AUTH_MAX_AGE_MS;
}

// PowerSync rows are dynamically typed at the SQLite boundary and normalized below.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Row = Record<string, any> & { id: string };

function nullableNumber(value: unknown) {
  return value === null || value === undefined ? null : Number(value);
}

export async function readSyncedFinanceSnapshot(db: AbstractPowerSyncDatabase): Promise<FinanceSnapshot | null> {
  const [walletRows, categoryRows, allocationRows, scheduleRows, transactionRows, preferenceRows, rateRows, positionRows, instrumentRows, quoteRows] = await Promise.all([
    db.getAll<Row>("select * from wallets order by created_at desc"),
    db.getAll<Row>("select * from finance_categories order by created_at"),
    db.getAll<Row>("select * from wallet_allocations order by created_at"),
    db.getAll<Row>("select * from finance_transaction_schedules order by created_at desc"),
    db.getAll<Row>("select * from finance_transactions order by occurred_at desc, created_at desc"),
    db.getAll<Row>("select * from user_preferences limit 1"),
    db.getAll<Row>("select * from fx_rates"),
    db.getAll<Row>("select * from investment_positions order by created_at"),
    db.getAll<Row>("select * from investment_instruments"),
    db.getAll<Row>("select * from investment_quotes order by market_date desc"),
  ]);

  const hasAnySyncedRows = walletRows.length + categoryRows.length + transactionRows.length + preferenceRows.length > 0;
  if (!hasAnySyncedRows && !db.currentStatus.lastSyncedAt) return null;

  const accounts: Account[] = walletRows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    type: row.type,
    cash_kind: row.cash_kind,
    debt_kind: row.debt_kind,
    balance: Number(row.balance),
    credit_limit: nullableNumber(row.credit_limit),
    currency: row.currency,
    created_at: row.created_at,
    sync_version: Number(row.sync_version ?? 1),
  }));
  const categories: Category[] = categoryRows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    type: row.type,
    parent_id: row.parent_id,
    is_system: Boolean(row.is_system),
    purpose: row.purpose,
    created_at: row.created_at,
    sync_version: Number(row.sync_version ?? 1),
  }));
  const allocations: WalletAllocation[] = allocationRows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    wallet_id: row.wallet_id,
    name: row.name,
    kind: row.kind,
    amount: Number(row.amount),
    target_amount: nullableNumber(row.target_amount),
    created_at: row.created_at,
    updated_at: row.updated_at,
    sync_version: Number(row.sync_version ?? 1),
  }));

  const accountsById = new Map(accounts.map((value) => [value.id, value]));
  const categoriesById = new Map(categories.map((value) => [value.id, value]));
  const allocationsById = new Map(allocations.map((value) => [value.id, value]));

  const schedules: TransactionSchedule[] = scheduleRows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    note: row.note,
    start_date: row.start_date,
    frequency: row.frequency,
    interval_weeks: Number(row.interval_weeks ?? 1),
    until_date: row.until_date,
    state: row.state,
    kind: row.kind,
    amount: Number(row.amount),
    destination_amount: nullableNumber(row.destination_amount),
    fx_rate: nullableNumber(row.fx_rate),
    principal_amount: nullableNumber(row.principal_amount),
    interest_amount: nullableNumber(row.interest_amount),
    extra_principal_amount: nullableNumber(row.extra_principal_amount),
    category_id: row.category_id,
    source_account_id: row.source_account_id,
    destination_account_id: row.destination_account_id,
    allocation_id: row.allocation_id,
    category: row.category_id ? categoriesById.get(row.category_id) ?? null : null,
    source_account: row.source_account_id ? accountsById.get(row.source_account_id) ?? null : null,
    destination_account: row.destination_account_id ? accountsById.get(row.destination_account_id) ?? null : null,
    allocation: row.allocation_id ? allocationsById.get(row.allocation_id) ?? null : null,
    validation_error: null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    sync_version: Number(row.sync_version ?? 1),
  }));
  const schedulesById = new Map(schedules.map((value) => [value.id, value]));
  const instruments = new Map<string, InvestmentInstrument>(instrumentRows.map((row) => [row.id, {
    id: row.id,
    name: row.name,
    type: row.type,
    ticker: row.ticker,
    exchange: row.exchange,
    quote_currency: row.quote_currency,
    isin: row.isin,
    provider: row.provider,
    provider_symbol: row.provider_symbol,
  }]));
  const latestQuotes = new Map<string, InvestmentQuote>();
  for (const row of quoteRows) {
    if (!latestQuotes.has(row.instrument_id)) {
      latestQuotes.set(row.instrument_id, {
        instrument_id: row.instrument_id,
        provider: row.provider,
        market_date: row.market_date,
        price: Number(row.price),
        currency: row.currency,
        fetched_at: row.fetched_at,
      });
    }
  }

  const transactions: Transaction[] = transactionRows.map((row) => ({
    id: row.id,
    user_id: row.user_id,
    title: row.title,
    note: row.note,
    occurred_at: row.occurred_at,
    created_at: row.created_at,
    status: row.status,
    kind: row.kind,
    amount: Number(row.amount),
    destination_amount: nullableNumber(row.destination_amount),
    fx_rate: nullableNumber(row.fx_rate),
    principal_amount: nullableNumber(row.principal_amount),
    interest_amount: nullableNumber(row.interest_amount),
    extra_principal_amount: nullableNumber(row.extra_principal_amount),
    category_id: row.category_id,
    source_account_id: row.source_account_id,
    destination_account_id: row.destination_account_id,
    schedule_id: row.schedule_id,
    schedule_occurrence_date: row.schedule_occurrence_date,
    is_schedule_override: Boolean(row.is_schedule_override),
    allocation_id: row.allocation_id,
    category: row.category_id ? categoriesById.get(row.category_id) ?? null : null,
    source_account: row.source_account_id ? accountsById.get(row.source_account_id) ?? null : null,
    destination_account: row.destination_account_id ? accountsById.get(row.destination_account_id) ?? null : null,
    schedule: row.schedule_id ? schedulesById.get(row.schedule_id) ?? null : null,
    allocation: row.allocation_id ? allocationsById.get(row.allocation_id) ?? null : null,
    investment_instrument_id: row.investment_instrument_id,
    investment_units: nullableNumber(row.investment_units),
    investment_instrument: row.investment_instrument_id ? instruments.get(row.investment_instrument_id) ?? null : null,
    sync_version: Number(row.sync_version ?? 1),
  }));
  const investment_positions: InvestmentPosition[] = positionRows.flatMap((row) => {
    const instrument = instruments.get(row.instrument_id);
    if (!instrument) return [];
    return [{
      id: row.id,
      user_id: row.user_id,
      instrument_id: row.instrument_id,
      opening_units: Number(row.opening_units),
      created_at: row.created_at,
      updated_at: row.updated_at,
      instrument,
      latest_quote: latestQuotes.get(row.instrument_id) ?? null,
    }];
  });
  const exchange_rates: ExchangeRate[] = rateRows.map((row) => ({
    provider: row.provider,
    base_currency: row.base_currency,
    quote_currency: row.quote_currency,
    requested_date: row.requested_date,
    rate_date: row.rate_date,
    rate: Number(row.rate),
    fetched_at: row.fetched_at,
  }));

  const fallback = createEmptyFinanceSnapshot();
  const preference = preferenceRows[0];
  const preferences = preference
    ? { default_currency: preference.default_currency as CurrencyCode, default_currency_source: "saved" as const, sync_version: Number(preference.sync_version ?? 1) }
    : resolveUserPreferences(null, accounts);

  return { ...fallback, accounts, categories, allocations, schedules, transactions, preferences, exchange_rates, investment_positions };
}
