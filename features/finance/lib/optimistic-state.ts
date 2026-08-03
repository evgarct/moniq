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

export function createOptimisticId(_kind: string) {
  void _kind;
  return crypto.randomUUID();
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

export function enforceAllocationsLimit(snapshot: FinanceSnapshot, walletId: string): FinanceSnapshot {
  const wallet = snapshot.accounts.find((a) => a.id === walletId);
  if (!wallet || wallet.type !== "saving") return snapshot;

  const walletAllocations = snapshot.allocations.filter((a) => a.wallet_id === walletId);
  const totalAllocated = walletAllocations.reduce((sum, a) => sum + a.amount, 0);

  if (totalAllocated > wallet.balance) {
    throw new Error("Savings balance cannot be lower than its reserved goals.");
  }
  return snapshot;
}

export function syncAllocationsOnTransactionChange(
  snapshot: FinanceSnapshot,
  oldTransaction: Transaction | null,
  newTransaction: Transaction | null,
): FinanceSnapshot {
  let currentAllocations = [...snapshot.allocations];
  let currentTransactions = snapshot.transactions;
  const affectedWallets = new Set<string>();

  // 1. Reverse a linked fallback release before reversing the parent.
  if (oldTransaction) {
    const release = currentTransactions.find(
      (transaction) => transaction.system_generated && transaction.linked_transaction_id === oldTransaction.id,
    );
    if (release?.source_allocation_id) {
      currentAllocations = currentAllocations.map((allocation) =>
        allocation.id === release.source_allocation_id
          ? { ...allocation, amount: allocation.amount + release.amount, updated_at: new Date().toISOString() }
          : allocation,
      );
      currentTransactions = currentTransactions.filter((transaction) => transaction.id !== release.id);
    }
  }

  // 2. Reverse the effect of old transaction if it was paid
  if (oldTransaction && oldTransaction.status === "paid" && oldTransaction.allocation_id) {
    currentAllocations = currentAllocations.map((a) => {
      if (a.id === oldTransaction.allocation_id) {
        affectedWallets.add(a.wallet_id);
        const amountChange = oldTransaction.kind === "expense" ? oldTransaction.amount : -oldTransaction.amount;
        return {
          ...a,
          amount: Math.max(0, a.amount + amountChange),
          updated_at: new Date().toISOString(),
        };
      }
      return a;
    });
  }

  // 3. Apply the explicit goal effect of the new transaction.
  if (newTransaction && newTransaction.status === "paid" && newTransaction.allocation_id) {
    currentAllocations = currentAllocations.map((a) => {
      if (a.id === newTransaction.allocation_id) {
        affectedWallets.add(a.wallet_id);
        const amountChange = newTransaction.kind === "expense" ? -newTransaction.amount : newTransaction.amount;
        return {
          ...a,
          amount: Math.max(0, a.amount + amountChange),
          updated_at: new Date().toISOString(),
        };
      }
      return a;
    });
  }

  let nextSnapshot = {
    ...snapshot,
    allocations: currentAllocations,
    transactions: currentTransactions,
  };

  // 4. Release only the shortfall beyond Free from the default goal.
  if (newTransaction?.status === "paid" && !newTransaction.allocation_id && newTransaction.source_account_id) {
    const wallet = nextSnapshot.accounts.find((account) => account.id === newTransaction.source_account_id);
    const netOutflow = newTransaction.amount - (
      newTransaction.destination_account_id === newTransaction.source_account_id
        ? (newTransaction.destination_amount ?? newTransaction.amount)
        : 0
    );
    if (wallet?.type === "saving" && netOutflow > 0) {
      const walletAllocations = nextSnapshot.allocations.filter((allocation) => allocation.wallet_id === wallet.id);
      const shortfall = Math.max(walletAllocations.reduce((sum, allocation) => sum + allocation.amount, 0) - wallet.balance, 0);
      if (shortfall > 0) {
        const defaultGoal = walletAllocations.find((allocation) => allocation.is_default);
        if (!defaultGoal || defaultGoal.amount < shortfall) {
          throw new Error("Savings operation exceeds Free plus the default goal balance.");
        }
        const updatedDefault = { ...defaultGoal, amount: defaultGoal.amount - shortfall, updated_at: new Date().toISOString() };
        nextSnapshot = {
          ...nextSnapshot,
          allocations: nextSnapshot.allocations.map((allocation) => allocation.id === defaultGoal.id ? updatedDefault : allocation),
          transactions: [{
            ...newTransaction,
            id: createOptimisticId("savings-release"),
            title: defaultGoal.name,
            kind: "transfer",
            amount: shortfall,
            destination_amount: shortfall,
            category_id: null,
            category: null,
            source_account_id: wallet.id,
            destination_account_id: wallet.id,
            source_account: wallet,
            destination_account: wallet,
            allocation_id: null,
            allocation: null,
            source_allocation_id: defaultGoal.id,
            source_allocation: updatedDefault,
            linked_transaction_id: newTransaction.id,
            system_generated: true,
          }, ...nextSnapshot.transactions],
        };
      }
    }
  }

  // 5. Validate all affected wallets without trimming unrelated goals.
  if (oldTransaction) {
    if (oldTransaction.source_account_id) affectedWallets.add(oldTransaction.source_account_id);
    if (oldTransaction.destination_account_id) affectedWallets.add(oldTransaction.destination_account_id);
  }
  if (newTransaction) {
    if (newTransaction.source_account_id) affectedWallets.add(newTransaction.source_account_id);
    if (newTransaction.destination_account_id) affectedWallets.add(newTransaction.destination_account_id);
  }

  for (const walletId of affectedWallets) {
    nextSnapshot = enforceAllocationsLimit(nextSnapshot, walletId);
  }

  // Keep nested allocations on transaction records in sync
  const nextAllocationsMap = new Map(nextSnapshot.allocations.map((a) => [a.id, a]));
  nextSnapshot.transactions = nextSnapshot.transactions.map((t) => {
    if (t.allocation_id && nextAllocationsMap.has(t.allocation_id)) {
      return {
        ...t,
        allocation: nextAllocationsMap.get(t.allocation_id)!,
      };
    }
    if (t.source_allocation_id && nextAllocationsMap.has(t.source_allocation_id)) {
      return { ...t, source_allocation: nextAllocationsMap.get(t.source_allocation_id)! };
    }
    return t;
  });

  return nextSnapshot;
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
    investment_instrument: values.investment_instrument_id
      ? snapshot.investment_positions.find((position) => position.instrument_id === values.investment_instrument_id)?.instrument ?? null
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
    investment_instrument_id: values.investment_instrument_id ?? null,
    investment_units: values.investment_units ?? null,
    schedule: null,
    ...resolveTransactionRelations(snapshot, values),
  };
}

export function addTransaction(
  snapshot: FinanceSnapshot,
  values: TransactionInput,
  id?: string,
) {
  const transaction = makeOptimisticTransaction(snapshot, values, id);
  const snapshotWithBalance = {
    ...snapshot,
    accounts: applyPaidTransactionEffect(snapshot.accounts, transaction, 1),
    transactions: [transaction, ...snapshot.transactions],
  };
  return syncAllocationsOnTransactionChange(snapshotWithBalance, null, transaction);
}

export function addTransactionEntry(
  snapshot: FinanceSnapshot,
  input: TransactionEntryInput | TransactionEntryBatchInput,
  optimisticIds?: string[],
) {
  const entries = "entries" in input ? input.entries : [input];
  return entries.reduce(
    (current, entry, index) => addTransaction(current, entry, optimisticIds?.[index]),
    snapshot,
  );
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
    investment_instrument_id: values.investment_instrument_id ?? null,
    investment_units: values.investment_units ?? null,
    is_schedule_override: existing.schedule_id ? true : existing.is_schedule_override,
    ...resolveTransactionRelations(snapshot, values),
  };
  const reversedAccounts = applyPaidTransactionEffect(snapshot.accounts, existing, -1);
  const snapshotWithBalance = {
    ...snapshot,
    accounts: applyPaidTransactionEffect(reversedAccounts, nextTransaction, 1),
    transactions: snapshot.transactions.map((transaction) =>
      transaction.id === transactionId ? nextTransaction : transaction,
    ),
  };
  return syncAllocationsOnTransactionChange(snapshotWithBalance, existing, nextTransaction);
}

export function removeTransaction(snapshot: FinanceSnapshot, transactionId: string) {
  const existing = snapshot.transactions.find((transaction) => transaction.id === transactionId);
  if (!existing) return snapshot;
  const snapshotWithBalance = {
    ...snapshot,
    accounts: applyPaidTransactionEffect(snapshot.accounts, existing, -1),
    transactions: snapshot.transactions.filter((transaction) => transaction.id !== transactionId),
  };
  return syncAllocationsOnTransactionChange(snapshotWithBalance, existing, null);
}

export function setTransactionStatus(
  snapshot: FinanceSnapshot,
  transactionId: string,
  status: Transaction["status"],
) {
  const existing = snapshot.transactions.find((transaction) => transaction.id === transactionId);
  if (!existing || existing.status === status) return snapshot;
  const next = { ...existing, status };
  const snapshotWithBalance = {
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
  return syncAllocationsOnTransactionChange(snapshotWithBalance, existing, next);
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
  optimisticId?: string,
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
    id: optimisticId ?? createOptimisticId("wallet"),
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
  const nextSnapshot = {
    ...snapshot,
    accounts: snapshot.accounts.map((account) =>
      account.id === walletId ? { ...account, balance: newBalance } : account,
    ),
  };
  return enforceAllocationsLimit(nextSnapshot, walletId);
}

export function saveCategory(
  snapshot: FinanceSnapshot,
  mode: "add" | "edit",
  values: CategoryInput,
  categoryId?: string,
  optimisticId?: string,
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
    id: optimisticId ?? createOptimisticId("category"),
    user_id: snapshot.categories[0]?.user_id ?? "optimistic",
    name: values.name,
    description: values.description ?? null,
    icon: values.icon ?? null,
    type: values.type,
    parent_id: values.parent_id ?? null,
    is_system: false,
    purpose: null,
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
  optimisticId?: string,
) {
  if (mode === "edit" && allocationId) {
    const nextAllocations = values.is_default
      ? snapshot.allocations.map((allocation) =>
          allocation.wallet_id === snapshot.allocations.find((item) => item.id === allocationId)?.wallet_id
            ? { ...allocation, is_default: allocation.id === allocationId }
            : allocation,
        )
      : snapshot.allocations;
    return {
      ...snapshot,
      allocations: nextAllocations.map((allocation) =>
        allocation.id === allocationId
          ? { ...allocation, ...values, updated_at: new Date().toISOString() }
          : allocation,
      ),
    };
  }
  const allocation: WalletAllocation = {
    id: optimisticId ?? createOptimisticId("allocation"),
    user_id: snapshot.accounts[0]?.user_id ?? "optimistic",
    wallet_id: walletId ?? "",
    name: values.name,
    kind: values.kind,
    amount: values.amount,
    target_amount: values.target_amount ?? null,
    is_default: values.is_default || !snapshot.allocations.some((item) => item.wallet_id === walletId),
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

export function updateScheduleNoteFromDate(
  snapshot: FinanceSnapshot,
  scheduleId: string,
  fromOccurrenceDate: string,
  newNote: string | null,
) {
  return {
    ...snapshot,
    schedules: snapshot.schedules.map((schedule) =>
      schedule.id === scheduleId
        ? { ...schedule, note: newNote }
        : schedule,
    ),
    transactions: snapshot.transactions.map((transaction) =>
      transaction.schedule_id === scheduleId &&
      transaction.schedule_occurrence_date &&
      transaction.schedule_occurrence_date >= fromOccurrenceDate &&
      transaction.status === "planned"
        ? {
            ...transaction,
            note: newNote,
          }
        : transaction,
    ),
  };
}
