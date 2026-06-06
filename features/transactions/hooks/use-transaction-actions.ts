"use client";

import { useFinanceActions } from "@/features/finance/hooks/use-finance-actions";

export function useTransactionActions() {
  const actions = useFinanceActions();

  return {
    createEntry: actions.createTransaction,
    updateTransaction: actions.updateTransaction,
    updateTransactionOptimistic: actions.updateTransaction,
    deleteTransaction: actions.deleteTransaction,
    deleteTransactionOptimistic: actions.deleteTransaction,
    markPaid: actions.markTransactionPaid,
    markPaidOptimistic: actions.markTransactionPaid,
    skipOccurrence: actions.skipTransaction,
    skipOccurrenceOptimistic: actions.skipTransaction,
    updateSchedule: actions.updateSchedule,
    setScheduleState: actions.setScheduleState,
    deleteSchedule: actions.deleteSchedule,
    deleteScheduleOptimistic: (scheduleId: string, onError?: (error: unknown) => void) =>
      actions.deleteSchedule(scheduleId, { onError }),
    rescheduleFromDate: actions.rescheduleSchedule,
  };
}
