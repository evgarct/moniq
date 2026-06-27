"use client";

import { addMonths, format, startOfToday } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { CalendarGrid } from "@/components/calendar-grid";
import { FinanceBoardHeader, FinanceBoardPanel, FinanceBoardShell } from "@/components/finance-board-shell";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { TransactionFormSheet, type TransactionFormSubmitPayload } from "@/features/transactions/components/transaction-form-sheet";
import { useTransactionActions } from "@/features/transactions/hooks/use-transaction-actions";
import { isVisibleTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { calDate } from "@/lib/formatters";
import type { FinanceSnapshot, Transaction, TransactionSchedule } from "@/types/finance";

function sortTransactionsAscending(transactions: Transaction[]) {
  return [...transactions].sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
}

export function CalendarView({ snapshot }: { snapshot: FinanceSnapshot }) {
  const t = useTranslations("calendar");
  const transactionViewT = useTranslations("transactions.view");
  const formatDate = useFormatter();
  const [month, setMonth] = useState(startOfToday());
  const [selectedDate, setSelectedDate] = useState(startOfToday());
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<TransactionSchedule | null>(null);
  const [sheetMode, setSheetMode] = useState<"edit-transaction" | "edit-schedule">("edit-transaction");
  const [sheetOpen, setSheetOpen] = useState(false);
  const transactionActions = useTransactionActions();

  const selectedTransactions = useMemo(
    () =>
      sortTransactionsAscending(
        snapshot.transactions.filter(
          (transaction) =>
            isVisibleTransactionStatus(transaction.status) && transaction.occurred_at === format(selectedDate, "yyyy-MM-dd"),
        ),
      ),
    [selectedDate, snapshot.transactions],
  );

  return (
    <>
      <FinanceBoardShell className="h-full">
        <FinanceBoardHeader
          title={formatDate.dateTime(calDate(month), { month: "long", year: "numeric" })}
          actions={
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-[var(--radius-control)] border border-white/10 bg-white/4 text-[#dceeed] hover:bg-white/10 hover:text-white"
                onClick={() => setMonth((value) => addMonths(value, -1))}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-[var(--radius-control)] border border-white/10 bg-white/4 px-3 text-[#dceeed] hover:bg-white/10 hover:text-white"
                onClick={() => {
                  const today = startOfToday();
                  setMonth(today);
                  setSelectedDate(today);
                }}
              >
                {t("board.jumpToday")}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-[var(--radius-control)] border border-white/10 bg-white/4 text-[#dceeed] hover:bg-white/10 hover:text-white"
                onClick={() => setMonth((value) => addMonths(value, 1))}
              >
                <ChevronRight />
              </Button>
            </div>
          }
        />

        <div className="grid h-[calc(100%-73px)] min-h-0 lg:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="min-h-0 border-b border-white/10 px-5 py-4 lg:border-b-0 lg:border-r">
            <CalendarGrid
              month={month}
              selectedDate={selectedDate}
              transactions={snapshot.transactions}
              onSelectDate={(date) => {
                setSelectedDate(date);
                setMonth(date);
              }}
            />
          </div>

          <FinanceBoardPanel
            title={t("board.dayAgenda")}
            subtitle={t("board.dayDescription")}
            actions={
              <div className="rounded-[var(--radius-control)] border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-[#dceeed]">
                {formatDate.dateTime(calDate(selectedDate), { month: "long", day: "numeric" })}
              </div>
            }
            className="min-h-0"
          >
            {actionError ? (
              <div className="mb-3 rounded-[var(--radius-control)] border border-[#b85b44]/60 bg-[#5c3328]/40 px-3 py-2 text-sm text-[#ffd2c7]">
                {actionError}
              </div>
            ) : null}
            <TransactionList
              transactions={selectedTransactions}
              emptyMessage={t("board.empty")}
              variant="board"
              onEditOccurrence={(selectedTransaction) => {
                setSheetMode("edit-transaction");
                setEditingTransaction(selectedTransaction);
                setEditingSchedule(null);
                setSheetOpen(true);
              }}
              onEditSeries={(selectedTransaction) => {
                if (!selectedTransaction.schedule) return;
                setSheetMode("edit-schedule");
                setEditingTransaction(selectedTransaction);
                setEditingSchedule(selectedTransaction.schedule);
                setSheetOpen(true);
              }}
              onDeleteTransaction={(selectedTransaction) => {
                transactionActions.deleteTransactionOptimistic(selectedTransaction.id);
              }}
              onDeleteSeries={(selectedTransaction) => {
                if (!selectedTransaction.schedule_id) return;
                transactionActions.deleteSchedule(selectedTransaction.schedule_id, {
                  onError: (error) =>
                    setActionError(error instanceof Error ? error.message : transactionViewT("deleteError")),
                });
                setActionError(null);
              }}
              onMarkPaid={(selectedTransaction) => {
                transactionActions.markPaidOptimistic(selectedTransaction.id);
              }}
              onSkipOccurrence={(selectedTransaction) => {
                transactionActions.skipOccurrenceOptimistic(selectedTransaction.id);
              }}
              onToggleScheduleState={(selectedTransaction) => {
                if (!selectedTransaction.schedule_id || !selectedTransaction.schedule) return;
                transactionActions.setScheduleState(
                  selectedTransaction.schedule_id,
                  selectedTransaction.schedule.state === "paused" ? "active" : "paused",
                  {
                    onError: (error) =>
                      setActionError(error instanceof Error ? error.message : transactionViewT("saveError")),
                  },
                );
                setActionError(null);
              }}
            />
          </FinanceBoardPanel>
        </div>
      </FinanceBoardShell>

      <TransactionFormSheet
        open={sheetOpen}
        mode={sheetMode}
        transaction={editingTransaction}
        schedule={editingSchedule}
        accounts={snapshot.accounts}
        categories={snapshot.categories}
        allocations={snapshot.allocations}
        investmentPositions={snapshot.investment_positions}
        onOpenChange={setSheetOpen}
        onSubmit={(payload: TransactionFormSubmitPayload) => {
          const onError = (error: unknown) =>
            setActionError(error instanceof Error ? error.message : transactionViewT("saveError"));
          if (payload.kind === "transaction" && editingTransaction) {
            transactionActions.updateTransaction(editingTransaction.id, payload.values, { onError });
            if (payload.rescheduleFrom) {
              transactionActions.rescheduleFromDate(
                payload.rescheduleFrom.scheduleId,
                payload.rescheduleFrom.originalDate,
                payload.rescheduleFrom.newDate,
                { onError },
              );
            }
          } else if (payload.kind === "schedule" && editingSchedule) {
            transactionActions.updateSchedule(editingSchedule.id, payload.values, { onError });
          }
          setActionError(null);
        }}
      />
    </>
  );
}
