"use client";

import { useMemo } from "react";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
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
  financeSnapshotQueryKey,
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
  FinanceMutationCoordinator,
  type FinanceCommand,
} from "@/features/finance/lib/optimistic-coordinator";
import type { FinanceSnapshot, TransactionSchedule } from "@/types/finance";
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

const coordinators = new WeakMap<QueryClient, FinanceMutationCoordinator>();
let commandSequence = 0;

function getCoordinator(queryClient: QueryClient) {
  const existing = coordinators.get(queryClient);
  if (existing) return existing;
  const coordinator = new FinanceMutationCoordinator({
    read: () => queryClient.getQueryData<FinanceSnapshot>(financeSnapshotQueryKey),
    write: (snapshot) => queryClient.setQueryData(financeSnapshotQueryKey, snapshot),
  });
  coordinators.set(queryClient, coordinator);
  return coordinator;
}

type ActionOptions = {
  errorMessage?: string;
  onError?: (error: unknown) => void;
};

export function useFinanceActions() {
  const queryClient = useQueryClient();
  const coordinator = useMemo(() => getCoordinator(queryClient), [queryClient]);

  function execute(command: Omit<FinanceCommand, "id">, options?: ActionOptions) {
    commandSequence += 1;
    coordinator.execute({
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
      execute(
        {
          apply: (snapshot) => addTransactionEntry(snapshot, values),
          request: () => createTransactionRequest(values),
        },
        options,
      );
    },
    updateTransaction(transactionId: string, values: TransactionInput, options?: ActionOptions) {
      execute(
        {
          apply: (snapshot) => updateTransaction(snapshot, transactionId, values),
          request: () => updateTransactionRequest(transactionId, values),
        },
        options,
      );
    },
    deleteTransaction(transactionId: string, options?: ActionOptions) {
      execute(
        {
          apply: (snapshot) => removeTransaction(snapshot, transactionId),
          request: () => deleteTransactionRequest(transactionId),
        },
        options,
      );
    },
    markTransactionPaid(transactionId: string, options?: ActionOptions) {
      execute(
        {
          apply: (snapshot) => setTransactionStatus(snapshot, transactionId, "paid"),
          request: () => markTransactionPaidRequest(transactionId),
        },
        options,
      );
    },
    skipTransaction(transactionId: string, options?: ActionOptions) {
      execute(
        {
          apply: (snapshot) => setTransactionStatus(snapshot, transactionId, "skipped"),
          request: () => skipTransactionOccurrenceRequest(transactionId),
        },
        options,
      );
    },
    updateSchedule(scheduleId: string, values: TransactionScheduleInput, options?: ActionOptions) {
      execute(
        {
          apply: (snapshot) => updateSchedule(snapshot, scheduleId, values),
          request: () => updateTransactionScheduleRequest(scheduleId, values),
        },
        options,
      );
    },
    setScheduleState(
      scheduleId: string,
      state: TransactionSchedule["state"],
      options?: ActionOptions,
    ) {
      execute(
        {
          apply: (snapshot) => setScheduleState(snapshot, scheduleId, state),
          request: () => setTransactionScheduleStateRequest(scheduleId, state),
        },
        options,
      );
    },
    deleteSchedule(scheduleId: string, options?: ActionOptions) {
      execute(
        {
          apply: (snapshot) => deleteSchedule(snapshot, scheduleId),
          request: () => deleteTransactionScheduleRequest(scheduleId),
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
      execute(
        {
          apply: (snapshot) =>
            rescheduleFromDate(snapshot, scheduleId, fromOccurrenceDate, newOccurrenceDate),
          request: () =>
            rescheduleTransactionSeriesRequest(scheduleId, fromOccurrenceDate, newOccurrenceDate),
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
      execute(
        {
          apply: (snapshot) => saveWallet(snapshot, mode, values, walletId),
          request: () =>
            mode === "add" ? createWalletRequest(values) : updateWalletRequest(walletId!, values),
        },
        options,
      );
    },
    deleteWallet(walletId: string, options?: ActionOptions) {
      execute(
        {
          apply: (snapshot) => deleteWallet(snapshot, walletId),
          request: () => deleteWalletRequest(walletId),
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
      execute(
        {
          apply: (snapshot) => adjustWalletBalance(snapshot, walletId, newBalance),
          request: () => adjustWalletBalanceRequest(walletId, newBalance, note),
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
      execute(
        {
          apply: (snapshot) => saveCategory(snapshot, mode, values, categoryId),
          request: () =>
            mode === "add"
              ? createCategoryRequest(values)
              : updateCategoryRequest(categoryId!, values),
        },
        options,
      );
    },
    deleteCategory(
      categoryId: string,
      replacementCategoryId: string | null,
      options?: ActionOptions,
    ) {
      execute(
        {
          apply: (snapshot) => deleteCategory(snapshot, categoryId, replacementCategoryId),
          request: () => deleteCategoryRequest(categoryId, replacementCategoryId),
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
      execute(
        {
          apply: (snapshot) => saveAllocation(snapshot, mode, values, walletId, allocationId),
          request: () =>
            mode === "add"
              ? createWalletAllocationRequest(walletId!, values)
              : updateWalletAllocationRequest(allocationId!, values),
        },
        options,
      );
    },
    deleteAllocation(allocationId: string, options?: ActionOptions) {
      execute(
        {
          apply: (snapshot) => deleteAllocation(snapshot, allocationId),
          request: () => deleteWalletAllocationRequest(allocationId),
        },
        options,
      );
    },
    updatePreferences(values: UserPreferencesInput, options?: ActionOptions) {
      execute(
        {
          apply: (snapshot) => updateDefaultCurrency(snapshot, values.default_currency),
          request: () => updateUserPreferencesRequest(values),
        },
        options,
      );
    },
  };
}
