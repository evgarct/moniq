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
    deleteTransaction: (transactionId: string) => deleteTransactionMutation.mutateAsync(transactionId),
    updateSchedule: (scheduleId: string, values: TransactionScheduleInput) =>
      updateScheduleMutation.mutateAsync({ scheduleId, values }),
    setScheduleState: (scheduleId: string, state: TransactionSchedule["state"]) =>
      setScheduleStateMutation.mutateAsync({ scheduleId, state }),
    deleteSchedule: (scheduleId: string) => deleteScheduleMutation.mutateAsync(scheduleId),
    markPaid: (transactionId: string) => markPaidMutation.mutateAsync(transactionId),
    skipOccurrence: (transactionId: string) => skipOccurrenceMutation.mutateAsync(transactionId),
  };
}
