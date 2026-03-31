"use client";

import { addMonths, isBefore, isSameDay, isSameMonth, parseISO, startOfToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { CalendarGrid } from "@/components/calendar-grid";
import { FinanceBoardHeader, FinanceBoardPanel, FinanceBoardShell } from "@/components/finance-board-shell";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { TransactionFormSheet, type TransactionFormSubmitPayload } from "@/features/transactions/components/transaction-form-sheet";
import { TransactionRowActions } from "@/features/transactions/components/transaction-row-actions";
import { useTransactionActions } from "@/features/transactions/hooks/use-transaction-actions";
import { isVisibleTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { cn } from "@/lib/utils";
import type { FinanceSnapshot, Transaction } from "@/types/finance";

function sortTransactionsAscending(transactions: Transaction[]) {
  return [...transactions].sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
}

export function TodayView({ snapshot }: { snapshot: FinanceSnapshot }) {
  const t = useTranslations("today");
  const transactionViewT = useTranslations("transactions.view");
  const formatDate = useFormatter();
  const today = startOfToday();
  const transactionActions = useTransactionActions();
  const [month, setMonth] = useState(today);
  const [selectedDate, setSelectedDate] = useState(today);
  const [scope, setScope] = useState<"day" | "month">("day");
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingSeries, setEditingSeries] = useState<Transaction["schedule"] | null>(null);
  const [sheetMode, setSheetMode] = useState<"add" | "edit-transaction" | "edit-schedule">("add");
  const [sheetOpen, setSheetOpen] = useState(false);

  const plannedTransactions = useMemo(
    () =>
      sortTransactionsAscending(
        snapshot.transactions.filter(
          (transaction) => isVisibleTransactionStatus(transaction.status) && transaction.status === "planned",
        ),
      ),
    [snapshot.transactions],
  );

  const agendaTransactions = useMemo(() => {
    if (scope === "month") {
      return plannedTransactions.filter((transaction) => isSameMonth(parseISO(transaction.occurred_at), month));
    }

    const overdue = plannedTransactions.filter((transaction) => isBefore(parseISO(transaction.occurred_at), selectedDate));
    const dueToday = plannedTransactions.filter((transaction) => isSameDay(parseISO(transaction.occurred_at), selectedDate));

    if (dueToday.length > 0) {
      return [...overdue, ...dueToday];
    }

    const nextUpcoming = plannedTransactions
      .filter((transaction) => parseISO(transaction.occurred_at) > selectedDate)
      .slice(0, 3);

    return [...overdue, ...nextUpcoming];
  }, [month, plannedTransactions, scope, selectedDate]);

  const agendaTitle =
    scope === "month"
      ? t("board.visibleMonth")
      : formatDate.dateTime(selectedDate, { month: "long", day: "numeric" });
  const agendaSubtitle = scope === "month" ? t("board.monthDescription") : t("board.dayDescription");

  async function handleSubmit(payload: TransactionFormSubmitPayload) {
    try {
      if (payload.kind === "entry" || payload.kind === "entry-batch") {
        await transactionActions.createEntry(payload.values);
      } else if (payload.kind === "transaction" && editingTransaction) {
        await transactionActions.updateTransaction(editingTransaction.id, payload.values);
      } else if (payload.kind === "schedule" && editingSeries) {
        await transactionActions.updateSchedule(editingSeries.id, payload.values);
      }
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : transactionViewT("saveError"));
      throw error;
    }
  }

  return (
    <>
      <FinanceBoardShell className="h-full min-h-[720px]">
        <FinanceBoardHeader
          title={formatDate.dateTime(month, { month: "long", year: "numeric" })}
          actions={
            <div className="flex items-center gap-2">
              <div className="hidden items-center rounded-md border border-white/10 bg-white/4 p-1 sm:flex">
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "rounded-sm px-3 text-[#8fb0b1] hover:bg-transparent hover:text-white",
                    scope === "day" && "bg-white/12 text-white hover:bg-white/12",
                  )}
                  onClick={() => setScope("day")}
                >
                  {t("board.scopeDay")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "rounded-sm px-3 text-[#8fb0b1] hover:bg-transparent hover:text-white",
                    scope === "month" && "bg-white/12 text-white hover:bg-white/12",
                  )}
                  onClick={() => setScope("month")}
                >
                  {t("board.scopeMonth")}
                </Button>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-md border border-white/10 bg-white/4 text-[#dceeed] hover:bg-white/10 hover:text-white"
                onClick={() => setMonth((value) => addMonths(value, -1))}
              >
                <ChevronLeft />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-md border border-white/10 bg-white/4 px-3 text-[#dceeed] hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setMonth(today);
                  setSelectedDate(today);
                }}
              >
                {t("board.jumpToday")}
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-md border border-white/10 bg-white/4 text-[#dceeed] hover:bg-white/10 hover:text-white"
                onClick={() => setMonth((value) => addMonths(value, 1))}
              >
                <ChevronRight />
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-md border border-white/10 bg-white/4 text-[#dceeed] hover:bg-white/10 hover:text-white"
                onClick={() => {
                  setSheetMode("add");
                  setEditingTransaction(null);
                  setEditingSeries(null);
                  setSheetOpen(true);
                }}
              >
                <Plus />
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
                if (!isSameMonth(date, month)) {
                  setMonth(date);
                }
                setScope("day");
              }}
            />
          </div>

          <FinanceBoardPanel
            title={t("board.agendaTitle")}
            subtitle={agendaSubtitle}
            actions={
              <div className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-[#dceeed]">
                {agendaTitle}
              </div>
            }
            className="min-h-0"
          >
            {actionError ? (
              <div className="mb-3 rounded-lg border border-[#b85b44]/60 bg-[#5c3328]/40 px-3 py-2 text-sm text-[#ffd2c7]">
                {actionError}
              </div>
            ) : null}
            <TransactionList
              transactions={agendaTransactions}
              emptyMessage={t("board.empty")}
              variant="board"
              renderAction={(transaction) => (
                <TransactionRowActions
                  compact
                  variant="board"
                  transaction={transaction}
                  onEditOccurrence={(selectedTransaction) => {
                    setSheetMode("edit-transaction");
                    setEditingTransaction(selectedTransaction);
                    setEditingSeries(null);
                    setSheetOpen(true);
                  }}
                  onEditSeries={(selectedTransaction) => {
                    if (!selectedTransaction.schedule) {
                      return;
                    }

                    setSheetMode("edit-schedule");
                    setEditingTransaction(selectedTransaction);
                    setEditingSeries(selectedTransaction.schedule);
                    setSheetOpen(true);
                  }}
                  onDeleteTransaction={async (selectedTransaction) => {
                    try {
                      await transactionActions.deleteTransaction(selectedTransaction.id);
                      setActionError(null);
                    } catch (error) {
                      setActionError(error instanceof Error ? error.message : transactionViewT("deleteError"));
                    }
                  }}
                  onDeleteSeries={async (selectedTransaction) => {
                    if (!selectedTransaction.schedule_id) {
                      return;
                    }

                    try {
                      await transactionActions.deleteSchedule(selectedTransaction.schedule_id);
                      setActionError(null);
                    } catch (error) {
                      setActionError(error instanceof Error ? error.message : transactionViewT("deleteError"));
                    }
                  }}
                  onMarkPaid={async (selectedTransaction) => {
                    try {
                      await transactionActions.markPaid(selectedTransaction.id);
                      setActionError(null);
                    } catch (error) {
                      setActionError(error instanceof Error ? error.message : transactionViewT("saveError"));
                    }
                  }}
                  onSkipOccurrence={async (selectedTransaction) => {
                    try {
                      await transactionActions.skipOccurrence(selectedTransaction.id);
                      setActionError(null);
                    } catch (error) {
                      setActionError(error instanceof Error ? error.message : transactionViewT("saveError"));
                    }
                  }}
                  onToggleScheduleState={async (selectedTransaction) => {
                    if (!selectedTransaction.schedule_id || !selectedTransaction.schedule) {
                      return;
                    }

                    try {
                      await transactionActions.setScheduleState(
                        selectedTransaction.schedule_id,
                        selectedTransaction.schedule.state === "paused" ? "active" : "paused",
                      );
                      setActionError(null);
                    } catch (error) {
                      setActionError(error instanceof Error ? error.message : transactionViewT("saveError"));
                    }
                  }}
                />
              )}
            />
          </FinanceBoardPanel>
        </div>
      </FinanceBoardShell>

      <TransactionFormSheet
        open={sheetOpen}
        mode={sheetMode}
        transaction={editingTransaction}
        schedule={editingSeries}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        onOpenChange={setSheetOpen}
        onSubmit={handleSubmit}
      />
    </>
  );
}
