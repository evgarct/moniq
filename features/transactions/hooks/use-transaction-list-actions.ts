"use client";

import { useTranslations } from "next-intl";

import { useTransactionActions } from "@/features/transactions/hooks/use-transaction-actions";
import type { Transaction } from "@/types/finance";

export type TransactionListActionProps = {
  onEditOccurrence: (transaction: Transaction) => void;
  onEditSeries: (transaction: Transaction) => void;
  onDeleteTransaction: (transaction: Transaction) => void;
  onDeleteSeries: (transaction: Transaction) => void;
  onMarkPaid: (transaction: Transaction) => void;
  onSkipOccurrence: (transaction: Transaction) => void;
  onToggleScheduleState: (transaction: Transaction) => void;
};

/**
 * The one place that maps a transaction row's context-menu callbacks onto finance
 * mutations. Every list that renders `TransactionRow` spreads this so the menu is
 * identical everywhere; the row itself hides items that are not relevant for the
 * transaction (planned vs posted, recurring vs one-off).
 */
export function useTransactionListActions({
  onEdit,
  onEditSeries,
  onActionError,
}: {
  onEdit: (transaction: Transaction) => void;
  onEditSeries?: (transaction: Transaction) => void;
  onActionError?: (message: string | null) => void;
}): TransactionListActionProps {
  const viewT = useTranslations("transactions.view");
  const actions = useTransactionActions();

  const reportError = (fallback: string) => (error: unknown) =>
    onActionError?.(error instanceof Error ? error.message : fallback);

  return {
    onEditOccurrence: onEdit,
    onEditSeries: (transaction) => {
      if (!transaction.schedule) return;
      (onEditSeries ?? onEdit)(transaction);
    },
    onDeleteTransaction: (transaction) => {
      actions.deleteTransactionOptimistic(transaction.id);
    },
    onDeleteSeries: (transaction) => {
      if (!transaction.schedule_id) return;
      actions.deleteScheduleOptimistic(transaction.schedule_id, reportError(viewT("deleteError")));
      onActionError?.(null);
    },
    onMarkPaid: (transaction) => {
      actions.markPaidOptimistic(transaction.id);
    },
    onSkipOccurrence: (transaction) => {
      actions.skipOccurrenceOptimistic(transaction.id);
    },
    onToggleScheduleState: (transaction) => {
      if (!transaction.schedule_id || !transaction.schedule) return;
      actions.setScheduleState(
        transaction.schedule_id,
        transaction.schedule.state === "paused" ? "active" : "paused",
        { onError: reportError(viewT("saveError")) },
      );
      onActionError?.(null);
    },
  };
}
