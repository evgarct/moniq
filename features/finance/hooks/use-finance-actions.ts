"use client";

import { useMemo } from "react";
import { applyPensionStatement, type PensionStatementInput } from "@/features/accounts/lib/pension";
import { savePensionStatementRequest } from "@/features/finance/lib/finance-api";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
  applyRecurringOccurrenceChangesRequest,
  adjustWalletBalanceRequest,
  createCategoryRequest,
  createTransactionRequest,
  createWalletAllocationRequest,
  createWalletRequest,
  deleteCategoryRequest,
  deleteTransactionRequest,
  deleteTransactionScheduleRequest,
  deleteWalletAllocationRequest,
  deleteWalletRequest,
  markTransactionPaidRequest,
  setTransactionScheduleStateRequest,
  skipTransactionOccurrenceRequest,
  updateCategoryRequest,
  saveCategoryBudgetRequest,
  clearCategoryBudgetOverrideRequest,
  updateTransactionRequest,
  updateTransactionScheduleRequest,
  updateUserPreferencesRequest,
  updateWalletAllocationRequest,
  updateWalletRequest,
  saveInvestmentPositionRequest,
} from "@/features/finance/lib/finance-api";
import {
  applyCategoryBudgetChange,
  clearCategoryBudgetOverrideRows,
  type CategoryBudgetChange,
} from "@/features/budget/lib/category-budget-changes";
import { applyRecurringOccurrenceChanges } from "@/features/transactions/lib/recurring-occurrence-changes";
import { savePositionOptimistically } from "@/features/investments/lib/positions";
import {
  addTransactionEntry,
  adjustWalletBalance,
  createOptimisticId,
  deleteAllocation,
  deleteCategory,
  deleteSchedule,
  deleteWallet,
  removeTransaction,
  saveAllocation,
  saveCategory,
  saveWallet,
  setScheduleState,
  setTransactionStatus,
  updateDefaultCurrency,
  updateSchedule,
  updateTransaction,
} from "@/features/finance/lib/optimistic-state";
import {
  type FinanceCommand,
  type ResolveFinanceId,
} from "@/features/finance/lib/optimistic-coordinator";
import { getFinanceMutationCoordinator } from "@/features/finance/lib/coordinator-registry";
import type {
  Account,
  Category,
  Transaction,
  TransactionSchedule,
  WalletAllocation,
  InvestmentInstrumentCandidate,
} from "@/types/finance";
import type {
  CategoryInput,
  RecurringOccurrenceChangesInput,
  TransactionEntryBatchInput,
  TransactionEntryInput,
  TransactionInput,
  TransactionScheduleInput,
  UserPreferencesInput,
  WalletAllocationInput,
  WalletInput,
} from "@/types/finance-schemas";

type ActionOptions = {
  errorMessage?: string;
  onError?: (error: unknown) => void;
};

function resolveRequiredId(resolveId: ResolveFinanceId, id: string) {
  return resolveId(id) ?? id;
}

function resolveOptionalId(resolveId: ResolveFinanceId, id: string | null | undefined) {
  return resolveId(id) ?? null;
}

function mapTransactionValues<T extends TransactionInput | TransactionEntryInput | TransactionScheduleInput>(
  values: T,
  resolveId: ResolveFinanceId,
): T {
  return {
    ...values,
    category_id: resolveOptionalId(resolveId, values.category_id),
    source_account_id: resolveOptionalId(resolveId, values.source_account_id),
    destination_account_id: resolveOptionalId(resolveId, values.destination_account_id),
    allocation_id: resolveOptionalId(resolveId, values.allocation_id),
    investment_instrument_id: resolveOptionalId(resolveId, values.investment_instrument_id),
  };
}

function mapTransactionEntry(
  values: TransactionEntryInput | TransactionEntryBatchInput,
  resolveId: ResolveFinanceId,
) {
  return "entries" in values
    ? { entries: values.entries.map((entry) => mapTransactionValues(entry, resolveId)) }
    : mapTransactionValues(values, resolveId);
}

function mapRecurringOccurrenceChanges(
  changes: RecurringOccurrenceChangesInput,
  resolveId: ResolveFinanceId,
): RecurringOccurrenceChangesInput {
  const mapped = { ...changes };
  if ("category_id" in mapped) mapped.category_id = resolveOptionalId(resolveId, mapped.category_id);
  if ("source_account_id" in mapped) mapped.source_account_id = resolveOptionalId(resolveId, mapped.source_account_id);
  if ("destination_account_id" in mapped) mapped.destination_account_id = resolveOptionalId(resolveId, mapped.destination_account_id);
  if ("allocation_id" in mapped) mapped.allocation_id = resolveOptionalId(resolveId, mapped.allocation_id);
  return mapped;
}

function mapCategoryValues(values: CategoryInput, resolveId: ResolveFinanceId): CategoryInput {
  return {
    ...values,
    parent_id: resolveOptionalId(resolveId, values.parent_id),
  };
}

function findCreated<T extends { id: string }>(
  previous: T[],
  next: T[],
  matches: (entity: T) => boolean,
) {
  const previousIds = new Set(previous.map((entity) => entity.id));
  return next.find((entity) => !previousIds.has(entity.id) && matches(entity));
}

function transactionMatchesInput(transaction: Transaction, values: TransactionEntryInput) {
  return (
    transaction.title === values.title &&
    transaction.kind === values.kind &&
    transaction.status === values.status &&
    transaction.occurred_at.slice(0, 10) === values.occurred_at.slice(0, 10) &&
    transaction.amount === values.amount &&
    transaction.category_id === (values.category_id ?? null) &&
    transaction.source_account_id === (values.source_account_id ?? null) &&
    transaction.destination_account_id === (values.destination_account_id ?? null) &&
    transaction.allocation_id === (values.allocation_id ?? null) &&
    transaction.investment_instrument_id === (values.investment_instrument_id ?? null) &&
    transaction.investment_units === (values.investment_units ?? null)
  );
}

export function useFinanceActions() {
  const queryClient = useQueryClient();
  const coordinator = useMemo(
    () => getFinanceMutationCoordinator(queryClient),
    [queryClient],
  );

  function execute(command: Omit<FinanceCommand, "id">, options?: ActionOptions) {
    return coordinator.execute({
      ...command,
      id: crypto.randomUUID(),
      onError(error) {
        options?.onError?.(error);
        toast.error(error instanceof Error ? error.message : options?.errorMessage);
      },
    });
  }

  return {
    savePensionStatement(walletId: string, statement: PensionStatementInput, options?: ActionOptions) {
      return execute({
        apply: (snapshot, resolveId) => ({ ...snapshot, accounts: snapshot.accounts.map((account) => account.id === resolveId(walletId) ? applyPensionStatement(account, statement, snapshot.transactions) : account) }),
        request: (resolveId) => savePensionStatementRequest(resolveId(walletId)!, statement),
      }, options);
    },
    createTransaction(values: TransactionEntryInput | TransactionEntryBatchInput, options?: ActionOptions) {
      const entries = "entries" in values ? values.entries : [values];
      const optimisticIds = entries.map(() => createOptimisticId("transaction"));
      return execute(
        {
          apply: (snapshot, resolveId) =>
            addTransactionEntry(snapshot, mapTransactionEntry(values, resolveId), optimisticIds),
          request: (resolveId) => createTransactionRequest(mapTransactionEntry(values, resolveId)),
          reconcile: (previous, next, resolveId) => {
            if (!previous) return [];
            const available = next.transactions.filter(
              (transaction) =>
                !previous.transactions.some((existing) => existing.id === transaction.id),
            );
            return entries.flatMap((entry, index) => {
              const mappedEntry = mapTransactionValues(entry, resolveId);
              const matchIndex = available.findIndex((transaction) =>
                transactionMatchesInput(transaction, mappedEntry),
              );
              if (matchIndex < 0) return [];
              const [match] = available.splice(matchIndex, 1);
              return [[optimisticIds[index], match.id] as const];
            });
          },
        },
        options,
      );
    },
    updateTransaction(transactionId: string, values: TransactionInput, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            updateTransaction(
              snapshot,
              resolveRequiredId(resolveId, transactionId),
              mapTransactionValues(values, resolveId),
            ),
          request: (resolveId) =>
            updateTransactionRequest(
              resolveRequiredId(resolveId, transactionId),
              mapTransactionValues(values, resolveId),
            ),
        },
        options,
      );
    },
    deleteTransaction(transactionId: string, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            removeTransaction(snapshot, resolveRequiredId(resolveId, transactionId)),
          request: (resolveId) =>
            deleteTransactionRequest(resolveRequiredId(resolveId, transactionId)),
        },
        options,
      );
    },
    markTransactionPaid(transactionId: string, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            setTransactionStatus(snapshot, resolveRequiredId(resolveId, transactionId), "paid"),
          request: (resolveId) =>
            markTransactionPaidRequest(resolveRequiredId(resolveId, transactionId)),
        },
        options,
      );
    },
    skipTransaction(transactionId: string, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            setTransactionStatus(snapshot, resolveRequiredId(resolveId, transactionId), "skipped"),
          request: (resolveId) =>
            skipTransactionOccurrenceRequest(resolveRequiredId(resolveId, transactionId)),
        },
        options,
      );
    },
    updateSchedule(scheduleId: string, values: TransactionScheduleInput, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            updateSchedule(
              snapshot,
              resolveRequiredId(resolveId, scheduleId),
              mapTransactionValues(values, resolveId),
            ),
          request: (resolveId) =>
            updateTransactionScheduleRequest(
              resolveRequiredId(resolveId, scheduleId),
              mapTransactionValues(values, resolveId),
            ),
        },
        options,
      );
    },
    setScheduleState(
      scheduleId: string,
      state: TransactionSchedule["state"],
      options?: ActionOptions,
    ) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            setScheduleState(snapshot, resolveRequiredId(resolveId, scheduleId), state),
          request: (resolveId) =>
            setTransactionScheduleStateRequest(resolveRequiredId(resolveId, scheduleId), state),
        },
        options,
      );
    },
    deleteSchedule(scheduleId: string, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            deleteSchedule(snapshot, resolveRequiredId(resolveId, scheduleId)),
          request: (resolveId) =>
            deleteTransactionScheduleRequest(resolveRequiredId(resolveId, scheduleId)),
        },
        options,
      );
    },
    applyRecurringOccurrenceChanges(
      scheduleId: string,
      fromOccurrenceDate: string,
      changes: RecurringOccurrenceChangesInput,
      options?: ActionOptions,
    ) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            applyRecurringOccurrenceChanges(
              snapshot,
              resolveRequiredId(resolveId, scheduleId),
              fromOccurrenceDate,
              mapRecurringOccurrenceChanges(changes, resolveId),
            ),
          request: (resolveId) =>
            applyRecurringOccurrenceChangesRequest(
              resolveRequiredId(resolveId, scheduleId),
              fromOccurrenceDate,
              mapRecurringOccurrenceChanges(changes, resolveId),
            ),
        },
        options,
      );
    },
    saveWallet(
      mode: "add" | "edit",
      values: WalletInput,
      walletId?: string,
      options?: ActionOptions,
    ) {
      const optimisticId = mode === "add" ? createOptimisticId("wallet") : undefined;
      return execute(
        {
          apply: (snapshot, resolveId) =>
            saveWallet(
              snapshot,
              mode,
              values,
              walletId ? resolveRequiredId(resolveId, walletId) : undefined,
              optimisticId,
            ),
          request: (resolveId) =>
            mode === "add"
              ? createWalletRequest(values)
              : updateWalletRequest(resolveRequiredId(resolveId, walletId!), values),
          reconcile: (previous, next) => {
            if (!previous || !optimisticId) return [];
            const created = findCreated<Account>(
              previous.accounts,
              next.accounts,
              (account) =>
                account.name === values.name &&
                account.type === values.type &&
                account.currency === values.currency,
            );
            return created ? [[optimisticId, created.id]] : [];
          },
        },
        options,
      );
    },
    deleteWallet(walletId: string, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            deleteWallet(snapshot, resolveRequiredId(resolveId, walletId)),
          request: (resolveId) => deleteWalletRequest(resolveRequiredId(resolveId, walletId)),
        },
        options,
      );
    },
    adjustWalletBalance(
      walletId: string,
      newBalance: number,
      note: string | null,
      options?: ActionOptions,
    ) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            adjustWalletBalance(snapshot, resolveRequiredId(resolveId, walletId), newBalance),
          request: (resolveId) =>
            adjustWalletBalanceRequest(resolveRequiredId(resolveId, walletId), newBalance, note),
        },
        options,
      );
    },
    saveCategory(
      mode: "add" | "edit",
      values: CategoryInput,
      categoryId?: string,
      options?: ActionOptions,
    ) {
      const optimisticId = mode === "add" ? createOptimisticId("category") : undefined;
      return execute(
        {
          apply: (snapshot, resolveId) =>
            saveCategory(
              snapshot,
              mode,
              mapCategoryValues(values, resolveId),
              categoryId ? resolveRequiredId(resolveId, categoryId) : undefined,
              optimisticId,
            ),
          request: (resolveId) =>
            mode === "add"
              ? createCategoryRequest(mapCategoryValues(values, resolveId))
              : updateCategoryRequest(
                  resolveRequiredId(resolveId, categoryId!),
                  mapCategoryValues(values, resolveId),
                ),
          reconcile: (previous, next, resolveId) => {
            if (!previous || !optimisticId) return [];
            const mappedValues = mapCategoryValues(values, resolveId);
            const created = findCreated<Category>(
              previous.categories,
              next.categories,
              (category) =>
                category.name === mappedValues.name &&
                category.type === mappedValues.type &&
                category.parent_id === (mappedValues.parent_id ?? null),
            );
            return created ? [[optimisticId, created.id]] : [];
          },
        },
        options,
      );
    },
    saveCategoryBudget(change: CategoryBudgetChange, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot, resolveId) => ({
            ...snapshot,
            category_budgets: applyCategoryBudgetChange(snapshot.category_budgets ?? [], {
              ...change,
              categoryId: resolveRequiredId(resolveId, change.categoryId),
            }),
          }),
          request: (resolveId) =>
            saveCategoryBudgetRequest(resolveRequiredId(resolveId, change.categoryId), {
              month: change.month,
              scope: change.scope,
              amount: change.amount,
            }),
        },
        options,
      );
    },
    clearCategoryBudgetOverride(categoryId: string, month: string, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot, resolveId) => ({
            ...snapshot,
            category_budgets: clearCategoryBudgetOverrideRows(
              snapshot.category_budgets ?? [],
              resolveRequiredId(resolveId, categoryId),
              month,
            ),
          }),
          request: (resolveId) => clearCategoryBudgetOverrideRequest(resolveRequiredId(resolveId, categoryId), month),
        },
        options,
      );
    },
    deleteCategory(
      categoryId: string,
      replacementCategoryId: string | null,
      options?: ActionOptions,
    ) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            deleteCategory(
              snapshot,
              resolveRequiredId(resolveId, categoryId),
              resolveOptionalId(resolveId, replacementCategoryId),
            ),
          request: (resolveId) =>
            deleteCategoryRequest(
              resolveRequiredId(resolveId, categoryId),
              resolveOptionalId(resolveId, replacementCategoryId),
            ),
        },
        options,
      );
    },
    saveAllocation(
      mode: "add" | "edit",
      values: WalletAllocationInput,
      walletId?: string,
      allocationId?: string,
      options?: ActionOptions,
    ) {
      const optimisticId = mode === "add" ? createOptimisticId("allocation") : undefined;
      return execute(
        {
          apply: (snapshot, resolveId) =>
            saveAllocation(
              snapshot,
              mode,
              values,
              walletId ? resolveRequiredId(resolveId, walletId) : undefined,
              allocationId ? resolveRequiredId(resolveId, allocationId) : undefined,
              optimisticId,
            ),
          request: (resolveId) =>
            mode === "add"
              ? createWalletAllocationRequest(resolveRequiredId(resolveId, walletId!), values)
              : updateWalletAllocationRequest(resolveRequiredId(resolveId, allocationId!), values),
          reconcile: (previous, next, resolveId) => {
            if (!previous || !optimisticId) return [];
            const resolvedWalletId = resolveRequiredId(resolveId, walletId!);
            const created = findCreated<WalletAllocation>(
              previous.allocations,
              next.allocations,
              (allocation) =>
                allocation.wallet_id === resolvedWalletId &&
                allocation.name === values.name &&
                allocation.kind === values.kind,
            );
            return created ? [[optimisticId, created.id]] : [];
          },
        },
        options,
      );
    },
    deleteAllocation(allocationId: string, replacementAllocationId: string | null = null, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            deleteAllocation(snapshot, resolveRequiredId(resolveId, allocationId)),
          request: (resolveId) =>
            deleteWalletAllocationRequest(
              resolveRequiredId(resolveId, allocationId),
              resolveOptionalId(resolveId, replacementAllocationId),
            ),
        },
        options,
      );
    },
    updatePreferences(values: UserPreferencesInput, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot) => updateDefaultCurrency(snapshot, values.default_currency),
          request: () => updateUserPreferencesRequest(values),
        },
        options,
      );
    },
    saveInvestmentPosition(instrument: InvestmentInstrumentCandidate, openingUnits: number, options?: ActionOptions) {
      const optimisticId = createOptimisticId("investment-position");
      return execute({
        apply: (snapshot) => savePositionOptimistically(
          snapshot,
          { instrument, opening_units: openingUnits },
          optimisticId,
        ),
        request: () => saveInvestmentPositionRequest(instrument, openingUnits),
      }, options);
    },
  };
}
