"use client";

import { format, startOfToday } from "date-fns";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import {
  createTransactionRequest,
  deleteTransactionRequest,
  deleteTransactionScheduleRequest,
  financeSnapshotQueryKey,
  markTransactionPaidRequest,
  rescheduleTransactionSeriesRequest,
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

  const rescheduleSeriesMutation = useMutation({
    mutationFn: ({ scheduleId, fromOccurrenceDate, newOccurrenceDate }: { scheduleId: string; fromOccurrenceDate: string; newOccurrenceDate: string }) =>
      rescheduleTransactionSeriesRequest(scheduleId, fromOccurrenceDate, newOccurrenceDate),
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
    deleteScheduleOptimistic: (scheduleId: string, onError?: (error: unknown) => void) => {
      const todayStr = format(startOfToday(), "yyyy-MM-dd");
      const previous = queryClient.getQueryData<FinanceSnapshot>(financeSnapshotQueryKey);
      if (previous) {
        queryClient.setQueryData(financeSnapshotQueryKey, {
          ...previous,
          schedules: previous.schedules.filter((s) => s.id !== scheduleId),
          // Server deletes: non-paid AND schedule_occurrence_date >= today. Match exactly.
          transactions: previous.transactions.filter(
            (t) =>
              t.schedule_id !== scheduleId ||
              t.status === "paid" ||
              !t.schedule_occurrence_date ||
              t.schedule_occurrence_date < todayStr,
          ),
        });
      }
      deleteTransactionScheduleRequest(scheduleId)
        .then(setSnapshot)
        .catch((error) => {
          if (previous) queryClient.setQueryData(financeSnapshotQueryKey, previous);
          onError?.(error);
        });
    },
    updateTransactionOptimistic: (transactionId: string, values: TransactionInput) =>
      optimistic(
        (snap) => ({
          ...snap,
          transactions: snap.transactions.map((t) =>
            t.id === transactionId
              ? {
                  ...t,
                  ...values,
                  category: values.category_id
                    ? (snap.categories.find((c) => c.id === values.category_id) ?? t.category)
                    : null,
                  source_account: values.source_account_id
                    ? (snap.accounts.find((a) => a.id === values.source_account_id) ?? t.source_account)
                    : t.source_account,
                  destination_account: values.destination_account_id
                    ? (snap.accounts.find((a) => a.id === values.destination_account_id) ?? t.destination_account)
                    : null,
                }
              : t,
          ),
        }),
        () => updateTransactionRequest(transactionId, values),
      ),

    updateSchedule: (scheduleId: string, values: TransactionScheduleInput) =>
      updateScheduleMutation.mutateAsync({ scheduleId, values }),
    setScheduleState: (scheduleId: string, state: TransactionSchedule["state"]) =>
      setScheduleStateMutation.mutateAsync({ scheduleId, state }),
    deleteSchedule: (scheduleId: string) => deleteScheduleMutation.mutateAsync(scheduleId),
    rescheduleFromDate: (scheduleId: string, fromOccurrenceDate: string, newOccurrenceDate: string) =>
      rescheduleSeriesMutation.mutateAsync({ scheduleId, fromOccurrenceDate, newOccurrenceDate }),
  };
}
