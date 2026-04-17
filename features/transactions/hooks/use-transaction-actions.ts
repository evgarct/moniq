"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createTransactionRequest,
  deleteTransactionRequest,
  deleteTransactionScheduleRequest,
  financeSnapshotQueryKey,
  markTransactionPaidRequest,
  setTransactionScheduleStateRequest,
  skipTransactionOccurrenceRequest,
  updateTransactionRequest,
  updateTransactionScheduleRequest,
} from "@/features/finance/lib/finance-api";
import type { FinanceSnapshot, TransactionSchedule } from "@/types/finance";
import type { TransactionEntryBatchInput, TransactionEntryInput, TransactionInput, TransactionScheduleInput } from "@/types/finance-schemas";

export function useTransactionActions() {
  const queryClient = useQueryClient();

  const setSnapshot = (nextSnapshot: FinanceSnapshot) => {
    queryClient.setQueryData(financeSnapshotQueryKey, nextSnapshot);
  };

  // Optimistic helper: apply a local patch immediately, fire the request in the
  // background, then sync with the authoritative server response. Reverts on error.
  function optimistic(
    patch: (current: FinanceSnapshot) => FinanceSnapshot,
    request: () => Promise<FinanceSnapshot>,
  ) {
    const previous = queryClient.getQueryData<FinanceSnapshot>(financeSnapshotQueryKey);
    if (previous) {
      queryClient.setQueryData(financeSnapshotQueryKey, patch(previous));
    }
    request()
      .then(setSnapshot)
      .catch(() => {
        if (previous) {
          queryClient.setQueryData(financeSnapshotQueryKey, previous);
        }
      });
  }

  const createEntryMutation = useMutation({
    mutationFn: createTransactionRequest,
    onSuccess: setSnapshot,
  });

  const updateTransactionMutation = useMutation({
    mutationFn: ({ transactionId, values }: { transactionId: string; values: TransactionInput }) =>
      updateTransactionRequest(transactionId, values),
    onSuccess: setSnapshot,
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: deleteTransactionRequest,
    onSuccess: setSnapshot,
  });

  const updateScheduleMutation = useMutation({
    mutationFn: ({ scheduleId, values }: { scheduleId: string; values: TransactionScheduleInput }) =>
      updateTransactionScheduleRequest(scheduleId, values),
    onSuccess: setSnapshot,
  });

  const setScheduleStateMutation = useMutation({
    mutationFn: ({ scheduleId, state }: { scheduleId: string; state: TransactionSchedule["state"] }) =>
      setTransactionScheduleStateRequest(scheduleId, state),
    onSuccess: setSnapshot,
  });

  const deleteScheduleMutation = useMutation({
    mutationFn: deleteTransactionScheduleRequest,
    onSuccess: setSnapshot,
  });

  const markPaidMutation = useMutation({
    mutationFn: markTransactionPaidRequest,
    onSuccess: setSnapshot,
  });

  const skipOccurrenceMutation = useMutation({
    mutationFn: skipTransactionOccurrenceRequest,
    onSuccess: setSnapshot,
  });

  return {
    createEntry: (values: TransactionEntryInput | TransactionEntryBatchInput) => createEntryMutation.mutateAsync(values),
    updateTransaction: (transactionId: string, values: TransactionInput) =>
      updateTransactionMutation.mutateAsync({ transactionId, values }),

    // Blocking versions (await server before UI update) — used for create/edit
    deleteTransaction: (transactionId: string) => deleteTransactionMutation.mutateAsync(transactionId),
    markPaid: (transactionId: string) => markPaidMutation.mutateAsync(transactionId),
    skipOccurrence: (transactionId: string) => skipOccurrenceMutation.mutateAsync(transactionId),

    // Optimistic versions — UI updates instantly, server syncs in background
    deleteTransactionOptimistic: (transactionId: string) =>
      optimistic(
        (snap) => ({ ...snap, transactions: snap.transactions.filter((t) => t.id !== transactionId) }),
        () => deleteTransactionRequest(transactionId),
      ),
    markPaidOptimistic: (transactionId: string) =>
      optimistic(
        (snap) => ({
          ...snap,
          transactions: snap.transactions.map((t) =>
            t.id === transactionId ? { ...t, status: "paid" as const } : t,
          ),
        }),
        () => markTransactionPaidRequest(transactionId),
      ),
    skipOccurrenceOptimistic: (transactionId: string) =>
      optimistic(
        (snap) => ({
          ...snap,
          transactions: snap.transactions.map((t) =>
            t.id === transactionId ? { ...t, status: "skipped" as const } : t,
          ),
        }),
        () => skipTransactionOccurrenceRequest(transactionId),
      ),

    updateSchedule: (scheduleId: string, values: TransactionScheduleInput) =>
      updateScheduleMutation.mutateAsync({ scheduleId, values }),
    setScheduleState: (scheduleId: string, state: TransactionSchedule["state"]) =>
      setScheduleStateMutation.mutateAsync({ scheduleId, state }),
    deleteSchedule: (scheduleId: string) => deleteScheduleMutation.mutateAsync(scheduleId),
  };
}
