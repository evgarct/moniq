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
  updateScheduleNoteFromDateRequest,
  updateTransactionRequest,
  updateTransactionScheduleRequest,
  updateUserPreferencesRequest,
  updateWalletAllocationRequest,
  updateWalletRequest,
  saveInvestmentPositionRequest,
} from "@/features/finance/lib/finance-api";
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
  rescheduleFromDate,
  saveAllocation,
  saveCategory,
  saveWallet,
  setScheduleState,
  setTransactionStatus,
  updateDefaultCurrency,
  updateSchedule,
  updateScheduleNoteFromDate,
  updateTransaction,
} from "@/features/finance/lib/optimistic-state";
import {
  type FinanceCommand,
  type ResolveFinanceId,
} from "@/features/finance/lib/optimistic-coordinator";
import { getFinanceMutationCoordinator } from "@/features/finance/lib/coordinator-registry";
import {
  queueLocalFirstCommand,
  type SyncCommandDraft,
  useLocalFirst,
} from "@/features/sync/components/local-first-provider";
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
  const localFirst = useLocalFirst();
  const coordinator = useMemo(
    () => getFinanceMutationCoordinator(queryClient),
    [queryClient],
  );

  function execute(
    command: Omit<FinanceCommand, "id">,
    options?: ActionOptions,
    syncDraft?: (resolveId: ResolveFinanceId) => SyncCommandDraft,
  ) {
    const request = command.request;
    return coordinator.execute({
      ...command,
      id: crypto.randomUUID(),
      async request(resolveId) {
        const queue = async () => {
          if (!localFirst.enabled || !syncDraft) return false;
          return queueLocalFirstCommand(syncDraft(resolveId));
        };
        if (typeof navigator !== "undefined" && !navigator.onLine && await queue()) {
          const snapshot = queryClient.getQueryData<import("@/types/finance").FinanceSnapshot>(["finance-snapshot"]);
          if (snapshot) return snapshot;
        }
        try {
          return await request(resolveId);
        } catch (error) {
          if (error instanceof TypeError && await queue()) {
            const snapshot = queryClient.getQueryData<import("@/types/finance").FinanceSnapshot>(["finance-snapshot"]);
            if (snapshot) return snapshot;
          }
          throw error;
        }
      },
      onError(error) {
        options?.onError?.(error);
        toast.error(error instanceof Error ? error.message : options?.errorMessage);
      },
    });
  }

  function entityVersion(kind: "wallet" | "category" | "transaction" | "schedule" | "allocation" | "preferences", id?: string) {
    const snapshot = queryClient.getQueryData<import("@/types/finance").FinanceSnapshot>(["finance-snapshot"]);
    if (!snapshot) return null;
    if (kind === "preferences") return snapshot.preferences.sync_version ?? null;
    const collection = kind === "wallet" ? snapshot.accounts
      : kind === "category" ? snapshot.categories
        : kind === "transaction" ? snapshot.transactions
          : kind === "schedule" ? snapshot.schedules
            : snapshot.allocations;
    return collection.find((item) => item.id === id)?.sync_version ?? null;
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
        (resolveId) => {
          const mapped = mapTransactionEntry(values, resolveId);
          return {
            type: "transaction.create",
            targetId: optimisticIds.length === 1 ? optimisticIds[0] : null,
            baseVersion: null,
            payload: "entries" in mapped && optimisticIds.length > 1
              ? { entries: mapped.entries.map((entry, index) => ({ id: optimisticIds[index], values: entry })) }
              : mapped,
          };
        },
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
        (resolveId) => ({ type: "transaction.update", targetId: resolveRequiredId(resolveId, transactionId), baseVersion: entityVersion("transaction", transactionId), payload: mapTransactionValues(values, resolveId) }),
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
        (resolveId) => ({ type: "transaction.delete", targetId: resolveRequiredId(resolveId, transactionId), baseVersion: entityVersion("transaction", transactionId), payload: {} }),
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
        (resolveId) => ({ type: "transaction.markPaid", targetId: resolveRequiredId(resolveId, transactionId), baseVersion: entityVersion("transaction", transactionId), payload: {} }),
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
        (resolveId) => ({ type: "transaction.skip", targetId: resolveRequiredId(resolveId, transactionId), baseVersion: entityVersion("transaction", transactionId), payload: {} }),
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
        (resolveId) => ({ type: "schedule.update", targetId: resolveRequiredId(resolveId, scheduleId), baseVersion: entityVersion("schedule", scheduleId), payload: mapTransactionValues(values, resolveId) }),
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
        (resolveId) => ({ type: "schedule.state", targetId: resolveRequiredId(resolveId, scheduleId), baseVersion: entityVersion("schedule", scheduleId), payload: { state } }),
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
        (resolveId) => ({ type: "schedule.delete", targetId: resolveRequiredId(resolveId, scheduleId), baseVersion: entityVersion("schedule", scheduleId), payload: {} }),
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
        (resolveId) => ({ type: "schedule.reschedule", targetId: resolveRequiredId(resolveId, scheduleId), baseVersion: entityVersion("schedule", scheduleId), payload: { fromOccurrenceDate, newOccurrenceDate } }),
      );
    },
    updateScheduleNoteFromDate(
      scheduleId: string,
      fromOccurrenceDate: string,
      newNote: string | null,
      options?: ActionOptions,
    ) {
      return execute(
        {
          apply: (snapshot, resolveId) =>
            updateScheduleNoteFromDate(
              snapshot,
              resolveRequiredId(resolveId, scheduleId),
              fromOccurrenceDate,
              newNote,
            ),
          request: (resolveId) =>
            updateScheduleNoteFromDateRequest(
              resolveRequiredId(resolveId, scheduleId),
              fromOccurrenceDate,
              newNote,
            ),
        },
        options,
        (resolveId) => ({ type: "schedule.updateNote", targetId: resolveRequiredId(resolveId, scheduleId), baseVersion: entityVersion("schedule", scheduleId), payload: { note: newNote, fromOccurrenceDate } }),
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
        (resolveId) => ({
          type: mode === "add" ? "wallet.create" : "wallet.update",
          targetId: mode === "add" ? optimisticId! : resolveRequiredId(resolveId, walletId!),
          baseVersion: mode === "add" ? null : entityVersion("wallet", walletId),
          payload: values,
        }),
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
        (resolveId) => ({ type: "wallet.delete", targetId: resolveRequiredId(resolveId, walletId), baseVersion: entityVersion("wallet", walletId), payload: {} }),
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
        (resolveId) => ({ type: "wallet.adjust", targetId: resolveRequiredId(resolveId, walletId), baseVersion: entityVersion("wallet", walletId), payload: { newBalance, note } }),
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
        (resolveId) => ({
          type: mode === "add" ? "category.create" : "category.update",
          targetId: mode === "add" ? optimisticId! : resolveRequiredId(resolveId, categoryId!),
          baseVersion: mode === "add" ? null : entityVersion("category", categoryId),
          payload: mapCategoryValues(values, resolveId),
        }),
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
        (resolveId) => ({ type: "category.delete", targetId: resolveRequiredId(resolveId, categoryId), baseVersion: entityVersion("category", categoryId), payload: { replacementCategoryId: resolveOptionalId(resolveId, replacementCategoryId) } }),
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
        (resolveId) => ({
          type: mode === "add" ? "allocation.create" : "allocation.update",
          targetId: mode === "add" ? optimisticId! : resolveRequiredId(resolveId, allocationId!),
          baseVersion: mode === "add" ? null : entityVersion("allocation", allocationId),
          payload: mode === "add" ? { walletId: resolveRequiredId(resolveId, walletId!), values } : values,
        }),
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
        (resolveId) => ({ type: "allocation.delete", targetId: resolveRequiredId(resolveId, allocationId), baseVersion: entityVersion("allocation", allocationId), payload: {} }),
      );
    },
    updatePreferences(values: UserPreferencesInput, options?: ActionOptions) {
      return execute(
        {
          apply: (snapshot) => updateDefaultCurrency(snapshot, values.default_currency),
          request: () => updateUserPreferencesRequest(values),
        },
        options,
        () => ({ type: "preferences.update", targetId: null, baseVersion: entityVersion("preferences"), payload: values }),
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
