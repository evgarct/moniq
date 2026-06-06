import { addDays, differenceInCalendarDays, format, parseISO, startOfToday } from "date-fns";

import { normalizeAccountBalance, normalizeCreditLimit } from "@/features/accounts/lib/account-state";
import type {
  Account,
  Category,
  FinanceSnapshot,
  Transaction,
  TransactionSchedule,
  WalletAllocation,
} from "@/types/finance";
import type {
  CategoryInput,
  TransactionEntryBatchInput,
  TransactionEntryInput,
  TransactionInput,
  TransactionScheduleInput,
  WalletAllocationInput,
  WalletInput,
} from "@/types/finance-schemas";
import type { CurrencyCode } from "@/types/currency";

let optimisticSequence = 0;

export function createOptimisticId(kind: string) {
  optimisticSequence += 1;
  return `optimistic:${kind}:${optimisticSequence}`;
}

function updateAccountBalance(accounts: Account[], accountId: string | null, delta: number) {
  if (!accountId || delta === 0) return accounts;
  return accounts.map((account) =>
    account.id === accountId ? { ...account, balance: account.balance + delta } : account,
  );
}

export function applyPaidTransactionEffect(
  accounts: Account[],
  transaction: Transaction,
  direction: 1 | -1,
) {
  if (transaction.status !== "paid") return accounts;
  let next = updateAccountBalance(accounts, transaction.source_account_id, direction * -transaction.amount);
  next = updateAccountBalance(
    next,
    transaction.destination_account_id,
    direction * (transaction.destination_amount ?? transaction.amount),
  );
  return next;
}

function resolveTransactionRelations(snapshot: FinanceSnapshot, values: TransactionInput) {
  return {
    category: values.category_id
      ? snapshot.categories.find((category) => category.id === values.category_id) ?? null
      : null,
    source_account: values.source_account_id
      ? snapshot.accounts.find((account) => account.id === values.source_account_id) ?? null
      : null,
    destination_account: values.destination_account_id
      ? snapshot.accounts.find((account) => account.id === values.destination_account_id) ?? null
      : null,
    allocation: values.allocation_id
      ? snapshot.allocations.find((allocation) => allocation.id === values.allocation_id) ?? null
      : null,
  };
}

export function makeOptimisticTransaction(
  snapshot: FinanceSnapshot,
  values: TransactionInput,
  id = createOptimisticId("transaction"),
): Transaction {
  return {
    id,
    user_id: snapshot.accounts[0]?.user_id ?? snapshot.categories[0]?.user_id ?? "optimistic",
    title: values.title,
    note: values.note ?? null,
    occurred_at: values.occurred_at,
    created_at: new Date().toISOString(),
    status: values.status,
    kind: values.kind,
    amount: values.amount,
    destination_amount: values.destination_amount ?? null,
    fx_rate: values.fx_rate ?? null,
    principal_amount: values.principal_amount ?? null,
    interest_amount: values.interest_amount ?? null,
    extra_principal_amount: values.extra_principal_amount ?? null,
    category_id: values.category_id ?? null,
    source_account_id: values.source_account_id ?? null,
    destination_account_id: values.destination_account_id ?? null,
    schedule_id: null,
    schedule_occurrence_date: null,
    is_schedule_override: false,
    allocation_id: values.allocation_id ?? null,
    schedule: null,
    ...resolveTransactionRelations(snapshot, values),
  };
}

export function addTransaction(snapshot: FinanceSnapshot, values: TransactionInput) {
  const transaction = makeOptimisticTransaction(snapshot, values);
  return {
    ...snapshot,
    accounts: applyPaidTransactionEffect(snapshot.accounts, transaction, 1),
    transactions: [transaction, ...snapshot.transactions],
  };
}

export function addTransactionEntry(
  snapshot: FinanceSnapshot,
  input: TransactionEntryInput | TransactionEntryBatchInput,
) {
  const entries = "entries" in input ? input.entries : [input];
  return entries.reduce((current, entry) => addTransaction(current, entry), snapshot);
}

export function updateTransaction(snapshot: FinanceSnapshot, transactionId: string, values: TransactionInput) {
  const existing = snapshot.transactions.find((transaction) => transaction.id === transactionId);
  if (!existing) return snapshot;
  const nextTransaction: Transaction = {
    ...existing,
    ...values,
    note: values.note ?? null,
    destination_amount: values.destination_amount ?? null,
    fx_rate: values.fx_rate ?? null,
    principal_amount: values.principal_amount ?? null,
    interest_amount: values.interest_amount ?? null,
    extra_principal_amount: values.extra_principal_amount ?? null,
    allocation_id: values.allocation_id ?? null,
    is_schedule_override: existing.schedule_id ? true : existing.is_schedule_override,
    ...resolveTransactionRelations(snapshot, values),
  };
  const reversedAccounts = applyPaidTransactionEffect(snapshot.accounts, existing, -1);
  return {
    ...snapshot,
    accounts: applyPaidTransactionEffect(reversedAccounts, nextTransaction, 1),
    transactions: snapshot.transactions.map((transaction) =>
      transaction.id === transactionId ? nextTransaction : transaction,
    ),
  };
}

export function removeTransaction(snapshot: FinanceSnapshot, transactionId: string) {
  const existing = snapshot.transactions.find((transaction) => transaction.id === transactionId);
  if (!existing) return snapshot;
  return {
    ...snapshot,
    accounts: applyPaidTransactionEffect(snapshot.accounts, existing, -1),
    transactions: snapshot.transactions.filter((transaction) => transaction.id !== transactionId),
  };
}

export function setTransactionStatus(
  snapshot: FinanceSnapshot,
  transactionId: string,
  status: Transaction["status"],
) {
  const existing = snapshot.transactions.find((transaction) => transaction.id === transactionId);
  if (!existing || existing.status === status) return snapshot;
  const next = { ...existing, status };
  return {
    ...snapshot,
    accounts: applyPaidTransactionEffect(
      applyPaidTransactionEffect(snapshot.accounts, existing, -1),
      next,
      1,
    ),
    transactions: snapshot.transactions.map((transaction) =>
      transaction.id === transactionId ? next : transaction,
    ),
  };
}

export function updateSchedule(
  snapshot: FinanceSnapshot,
  scheduleId: string,
  values: TransactionScheduleInput,
) {
  const existing = snapshot.schedules.find((schedule) => schedule.id === scheduleId);
  if (!existing) return snapshot;
  const relations = resolveTransactionRelations(snapshot, { ...values, status: "planned" });
  const next: TransactionSchedule = {
    ...existing,
    title: values.title,
    note: values.note ?? null,
    start_date: values.occurred_at,
    frequency: values.recurrence.frequency,
    interval_weeks: values.recurrence.interval_weeks,
    until_date: values.recurrence.until_date ?? null,
    kind: values.kind,
    amount: values.amount,
    destination_amount: values.destination_amount ?? null,
    fx_rate: values.fx_rate ?? null,
    principal_amount: values.principal_amount ?? null,
    interest_amount: values.interest_amount ?? null,
    extra_principal_amount: values.extra_principal_amount ?? null,
    category_id: values.category_id ?? null,
    source_account_id: values.source_account_id ?? null,
    destination_account_id: values.destination_account_id ?? null,
    allocation_id: values.allocation_id ?? null,
    updated_at: new Date().toISOString(),
    ...relations,
  };
  return {
    ...snapshot,
    schedules: snapshot.schedules.map((schedule) => (schedule.id === scheduleId ? next : schedule)),
    transactions: snapshot.transactions.map((transaction) =>
      transaction.schedule_id === scheduleId && transaction.status === "planned" && !transaction.is_schedule_override
        ? {
            ...transaction,
            title: next.title,
            note: next.note,
            kind: next.kind,
            amount: next.amount,
            destination_amount: next.destination_amount,
            fx_rate: next.fx_rate,
            principal_amount: next.principal_amount,
            interest_amount: next.interest_amount,
            extra_principal_amount: next.extra_principal_amount,
            category_id: next.category_id,
            source_account_id: next.source_account_id,
            destination_account_id: next.destination_account_id,
            allocation_id: next.allocation_id,
            category: next.category,
            source_account: next.source_account,
            destination_account: next.destination_account,
            allocation: next.allocation,
            schedule: next,
          }
        : transaction,
    ),
  };
}

export function setScheduleState(
  snapshot: FinanceSnapshot,
  scheduleId: string,
  state: TransactionSchedule["state"],
) {
  return {
    ...snapshot,
    schedules: snapshot.schedules.map((schedule) =>
      schedule.id === scheduleId ? { ...schedule, state } : schedule,
    ),
    transactions: snapshot.transactions.map((transaction) =>
      transaction.schedule_id === scheduleId && transaction.schedule
        ? { ...transaction, schedule: { ...transaction.schedule, state } }
        : transaction,
    ),
  };
}

export function deleteSchedule(snapshot: FinanceSnapshot, scheduleId: string) {
  const today = format(startOfToday(), "yyyy-MM-dd");
  return {
    ...snapshot,
    schedules: snapshot.schedules.filter((schedule) => schedule.id !== scheduleId),
    transactions: snapshot.transactions.filter(
      (transaction) =>
        transaction.schedule_id !== scheduleId ||
        transaction.status === "paid" ||
        !transaction.schedule_occurrence_date ||
        transaction.schedule_occurrence_date < today,
    ),
  };
}

export function rescheduleFromDate(
  snapshot: FinanceSnapshot,
  scheduleId: string,
  fromOccurrenceDate: string,
  newOccurrenceDate: string,
) {
  const offset = differenceInCalendarDays(parseISO(newOccurrenceDate), parseISO(fromOccurrenceDate));
  return {
    ...snapshot,
    schedules: snapshot.schedules.map((schedule) =>
      schedule.id === scheduleId
        ? { ...schedule, start_date: format(addDays(parseISO(schedule.start_date), offset), "yyyy-MM-dd") }
        : schedule,
    ),
    transactions: snapshot.transactions.map((transaction) =>
      transaction.schedule_id === scheduleId &&
      transaction.schedule_occurrence_date &&
      transaction.schedule_occurrence_date >= fromOccurrenceDate &&
      transaction.status === "planned"
        ? {
            ...transaction,
            occurred_at: format(addDays(parseISO(transaction.occurred_at), offset), "yyyy-MM-dd"),
            schedule_occurrence_date: format(
              addDays(parseISO(transaction.schedule_occurrence_date), offset),
              "yyyy-MM-dd",
            ),
          }
        : transaction,
    ),
  };
}

export function saveWallet(
  snapshot: FinanceSnapshot,
  mode: "add" | "edit",
  values: WalletInput,
  walletId?: string,
) {
  if (mode === "edit" && walletId) {
    const account = snapshot.accounts.find((item) => item.id === walletId);
    if (!account) return snapshot;
    const next: Account = {
      ...account,
      ...values,
      balance: normalizeAccountBalance(values.type, values.balance),
      credit_limit: normalizeCreditLimit(values.type, values.credit_limit),
    };
    return {
      ...snapshot,
      accounts: snapshot.accounts.map((item) => (item.id === walletId ? next : item)),
      transactions: snapshot.transactions.map((transaction) => ({
        ...transaction,
        source_account: transaction.source_account_id === walletId ? next : transaction.source_account,
        destination_account:
          transaction.destination_account_id === walletId ? next : transaction.destination_account,
      })),
    };
  }

  const account: Account = {
    id: createOptimisticId("wallet"),
    user_id: snapshot.accounts[0]?.user_id ?? "optimistic",
    name: values.name,
    type: values.type,
    balance: normalizeAccountBalance(values.type, values.balance),
    credit_limit: normalizeCreditLimit(values.type, values.credit_limit),
    currency: values.currency,
    debt_kind: values.type === "debt" ? values.debt_kind ?? "personal" : null,
    cash_kind: values.type === "cash" ? "debit_card" : null,
    created_at: new Date().toISOString(),
  };
  return { ...snapshot, accounts: [account, ...snapshot.accounts] };
}

export function deleteWallet(snapshot: FinanceSnapshot, walletId: string) {
  return {
    ...snapshot,
    accounts: snapshot.accounts.filter((account) => account.id !== walletId),
    allocations: snapshot.allocations.filter((allocation) => allocation.wallet_id !== walletId),
    transactions: snapshot.transactions.filter(
      (transaction) =>
        transaction.source_account_id !== walletId && transaction.destination_account_id !== walletId,
    ),
  };
}

export function adjustWalletBalance(snapshot: FinanceSnapshot, walletId: string, newBalance: number) {
  return {
    ...snapshot,
    accounts: snapshot.accounts.map((account) =>
      account.id === walletId ? { ...account, balance: newBalance } : account,
    ),
  };
}

export function saveCategory(
  snapshot: FinanceSnapshot,
  mode: "add" | "edit",
  values: CategoryInput,
  categoryId?: string,
) {
  if (mode === "edit" && categoryId) {
    const existing = snapshot.categories.find((category) => category.id === categoryId);
    if (!existing) return snapshot;
    const next: Category = { ...existing, ...values, description: values.description ?? null };
    return {
      ...snapshot,
      categories: snapshot.categories.map((category) => (category.id === categoryId ? next : category)),
      transactions: snapshot.transactions.map((transaction) =>
        transaction.category_id === categoryId ? { ...transaction, category: next } : transaction,
      ),
    };
  }
  const category: Category = {
    id: createOptimisticId("category"),
    user_id: snapshot.categories[0]?.user_id ?? "optimistic",
    name: values.name,
    description: values.description ?? null,
    icon: values.icon ?? null,
    type: values.type,
    parent_id: values.parent_id ?? null,
    is_system: false,
    created_at: new Date().toISOString(),
  };
  return { ...snapshot, categories: [...snapshot.categories, category] };
}

export function deleteCategory(
  snapshot: FinanceSnapshot,
  categoryId: string,
  replacementCategoryId: string | null,
) {
  const replacement = replacementCategoryId
    ? snapshot.categories.find((category) => category.id === replacementCategoryId) ?? null
    : null;
  return {
    ...snapshot,
    categories: snapshot.categories.filter((category) => category.id !== categoryId),
    transactions: snapshot.transactions.map((transaction) =>
      transaction.category_id === categoryId
        ? { ...transaction, category_id: replacementCategoryId, category: replacement }
        : transaction,
    ),
  };
}

export function saveAllocation(
  snapshot: FinanceSnapshot,
  mode: "add" | "edit",
  values: WalletAllocationInput,
  walletId?: string,
  allocationId?: string,
) {
  if (mode === "edit" && allocationId) {
    return {
      ...snapshot,
      allocations: snapshot.allocations.map((allocation) =>
        allocation.id === allocationId
          ? { ...allocation, ...values, updated_at: new Date().toISOString() }
          : allocation,
      ),
    };
  }
  const allocation: WalletAllocation = {
    id: createOptimisticId("allocation"),
    user_id: snapshot.accounts[0]?.user_id ?? "optimistic",
    wallet_id: walletId ?? "",
    name: values.name,
    kind: values.kind,
    amount: values.amount,
    target_amount: values.target_amount ?? null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  return { ...snapshot, allocations: [...snapshot.allocations, allocation] };
}

export function deleteAllocation(snapshot: FinanceSnapshot, allocationId: string) {
  return {
    ...snapshot,
    allocations: snapshot.allocations.filter((allocation) => allocation.id !== allocationId),
    transactions: snapshot.transactions.map((transaction) =>
      transaction.allocation_id === allocationId
        ? { ...transaction, allocation_id: null, allocation: null }
        : transaction,
    ),
  };
}

export function updateDefaultCurrency(snapshot: FinanceSnapshot, defaultCurrency: CurrencyCode) {
  return {
    ...snapshot,
    preferences: {
      default_currency: defaultCurrency,
      default_currency_source: "saved" as const,
    },
  };
}
