"use client";

import { useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import {
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
  rescheduleTransactionSeriesRequest,
  setTransactionScheduleStateRequest,
  skipTransactionOccurrenceRequest,
  updateCategoryRequest,
  updateTransactionRequest,
  updateTransactionScheduleRequest,
  updateUserPreferencesRequest,
  updateWalletAllocationRequest,
  updateWalletRequest,
} from "@/features/finance/lib/finance-api";
import {
  addTransactionEntry,
  adjustWalletBalance,
  createOptimisticId,
  deleteAllocation,
  deleteCategory,
  deleteSchedule,
  deleteWallet,
  removeTransaction,
  rescheduleFromDate,
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
} from "@/types/finance";
import type {
  CategoryInput,
  TransactionEntryBatchInput,
  TransactionEntryInput,
  TransactionInput,
  TransactionScheduleInput,
  UserPreferencesInput,
  WalletAllocationInput,
  WalletInput,
} from "@/types/finance-schemas";

let commandSequence = 0;

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
    transaction.allocation_id === (values.allocation_id ?? null)
  );
}

export function useFinanceActions() {
  const queryClient = useQueryClient();
  const coordinator = useMemo(
    () => getFinanceMutationCoordinator(queryClient),
    [queryClient],
  );

  function execute(command: Omit<FinanceCommand, "id">, options?: ActionOptions) {
    commandSequence += 1;
    return coordinator.execute({
      ...command,
      id: `finance-command:${commandSequence}`,
      onError(error) {
        options?.onError?.(error);
        toast.error(error instanceof Error ? error.message : options?.errorMessage);
      },
    });
  }

  return {
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
    rescheduleSchedule(
      scheduleId: string,
      fromOccurrenceDate: string,
      newOccurrenceDate: string,
      options?: ActionOptions,
    ) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            rescheduleFromDate(
              snapshot,
              resolveRequiredId(resolveId, scheduleId),
              fromOccurrenceDate,
              newOccurrenceDate,
            ),
          request: (resolveId) =>
            rescheduleTransactionSeriesRequest(
              resolveRequiredId(resolveId, scheduleId),
              fromOccurrenceDate,
              newOccurrenceDate,
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
    deleteAllocation(allocationId: string, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            deleteAllocation(snapshot, resolveRequiredId(resolveId, allocationId)),
          request: (resolveId) =>
            deleteWalletAllocationRequest(resolveRequiredId(resolveId, allocationId)),
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
  };
}
