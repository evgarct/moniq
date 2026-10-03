"use client";

import { useState } from "react";

import { TransactionFormSheet, type TransactionFormSubmitPayload } from "@/features/transactions/components/transaction-form-sheet";
import { useTransactionActions } from "@/features/transactions/hooks/use-transaction-actions";
import { useTransactionListActions } from "@/features/transactions/hooks/use-transaction-list-actions";
import type { FinanceSnapshot, Transaction } from "@/types/finance";

/**
 * Row actions (edit, edit series, mark paid, skip, delete) for transaction lists on the Budget screen, plus the
 * edit sheet they open. Render `sheet` once next to the list.
 */
export function useBudgetTransactionEditor(snapshot: FinanceSnapshot) {
  const transactionActions = useTransactionActions();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [mode, setMode] = useState<"edit-transaction" | "edit-schedule">("edit-transaction");
  const [open, setOpen] = useState(false);
  const listActions = useTransactionListActions({
    onEdit(transaction) {
      setMode("edit-transaction");
      setEditingTransaction(transaction);
      setOpen(true);
    },
    onEditSeries(transaction) {
      setMode("edit-schedule");
      setEditingTransaction(transaction);
      setOpen(true);
    },
  });

  const sheet = (
    <TransactionFormSheet
      open={open}
      mode={mode}
      transaction={editingTransaction}
      schedule={mode === "edit-schedule" ? editingTransaction?.schedule ?? null : null}
      accounts={snapshot.accounts}
      categories={snapshot.categories}
      allocations={snapshot.allocations}
      investmentPositions={snapshot.investment_positions}
      onOpenChange={setOpen}
      onSubmit={(payload: TransactionFormSubmitPayload) => {
        if (payload.kind === "transaction" && editingTransaction) {
          transactionActions.updateTransactionOptimistic(editingTransaction.id, payload.values);
        } else if (payload.kind === "recurring-occurrence-series") {
          transactionActions.applyRecurringOccurrenceChanges(payload.scheduleId, payload.fromOccurrenceDate, payload.changes);
        } else if (payload.kind === "schedule" && editingTransaction?.schedule) {
          transactionActions.updateSchedule(editingTransaction.schedule.id, payload.values);
        }
      }}
    />
  );

  return { listActions, sheet };
}
