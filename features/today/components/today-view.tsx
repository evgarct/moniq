"use client";

import { addMonths, isSameDay, isSameMonth, startOfToday } from "date-fns";
import { ChevronLeft, ChevronRight, ListChecks, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { CalendarGrid } from "@/components/calendar-grid";
import { Surface } from "@/components/surface";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { TransactionFormSheet, type TransactionFormSubmitPayload } from "@/features/transactions/components/transaction-form-sheet";
import { TransactionRowActions } from "@/features/transactions/components/transaction-row-actions";
import { useTransactionActions } from "@/features/transactions/hooks/use-transaction-actions";
import { getTodayViewTransactions } from "@/features/today/lib/today-transactions";
import type { FinanceSnapshot, Transaction } from "@/types/finance";

export function TodayView({
  snapshot,
  initialMonth,
  initialSelectedDate,
}: {
  snapshot: FinanceSnapshot;
  initialMonth?: Date;
  initialSelectedDate?: Date | null;
}) {
  const t = useTranslations("today");
  const transactionViewT = useTranslations("transactions.view");
  const formatDate = useFormatter();
  const today = startOfToday();
  const transactionActions = useTransactionActions();
  const [month, setMonth] = useState(initialMonth ?? today);
  const [selectedDate, setSelectedDate] = useState<Date | null>(
    initialSelectedDate === undefined ? today : initialSelectedDate,
  );
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingSeries, setEditingSeries] = useState<Transaction["schedule"] | null>(null);
  const [sheetMode, setSheetMode] = useState<"add" | "edit-transaction" | "edit-schedule">("add");
  const [sheetOpen, setSheetOpen] = useState(false);

  const transactionState = useMemo(
    () =>
      getTodayViewTransactions({
        transactions: snapshot.transactions,
        month,
        selectedDate,
        today,
      }),
    [month, selectedDate, snapshot.transactions, today],
  );

  const agendaLabel =
    transactionState.mode === "today"
      ? t("board.todayTitle")
      : selectedDate
        ? formatDate.dateTime(selectedDate, { month: "long", day: "numeric" })
        : formatDate.dateTime(month, { month: "long", year: "numeric" });
  const agendaSubtitle =
    transactionState.mode === "today"
      ? t("board.todayDescription")
      : transactionState.mode === "day"
        ? t("board.selectedDescription")
        : t("board.monthDescription");
  const agendaEmptyMessage =
    transactionState.mode === "today"
      ? t("board.todayEmpty")
      : transactionState.mode === "day"
        ? t("board.selectedEmpty")
        : t("board.monthEmpty");

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
      <div className="flex h-full flex-col gap-4">
        <Surface tone="panel" padding="lg" className="border border-black/5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-foreground">
                <ListChecks className="size-[18px]" strokeWidth={1.8} />
              </div>
              <div className="flex flex-col gap-1">
                <h1 className="type-h3">{t("view.title")}</h1>
                <p className="type-body-14 max-w-[38rem] text-muted-foreground">{t("view.description")}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full bg-background"
                onClick={() => {
                  setMonth((value) => addMonths(value, -1));
                  setSelectedDate(null);
                }}
              >
                <ChevronLeft />
              </Button>
              <div className="rounded-full border border-border/80 bg-background px-4 py-2 text-sm font-medium text-foreground">
                {formatDate.dateTime(month, { month: "long", year: "numeric" })}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full bg-background px-4"
                onClick={() => {
                  setMonth(today);
                  setSelectedDate(today);
                }}
              >
                {t("board.jumpToday")}
              </Button>
              <Button
                variant="outline"
                size="icon-sm"
                className="rounded-full bg-background"
                onClick={() => {
                  setMonth((value) => addMonths(value, 1));
                  setSelectedDate(null);
                }}
              >
                <ChevronRight />
              </Button>
              <Button
                variant="default"
                size="icon-sm"
                className="rounded-full"
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
          </div>
        </Surface>

        <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(380px,0.88fr)]">
          <Surface tone="panel" padding="lg" className="min-h-0 border border-black/5">
            <CalendarGrid
              month={month}
              selectedDate={selectedDate}
              transactions={snapshot.transactions}
              onSelectDate={(date) => {
                if (selectedDate && isSameDay(date, selectedDate)) {
                  setSelectedDate(null);
                  return;
                }

                setSelectedDate(date);
                if (!isSameMonth(date, month)) {
                  setMonth(date);
                }
              }}
            />
          </Surface>

          <Surface tone="panel" padding="lg" className="min-h-0 border border-black/5">
            <div className="flex h-full min-h-0 flex-col">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("board.agendaTitle")}</p>
                  <h2 className="mt-1 text-lg font-medium tracking-[-0.03em] text-foreground">{agendaLabel}</h2>
                  <p className="mt-1 text-sm leading-5 text-muted-foreground">{agendaSubtitle}</p>
                </div>
                {selectedDate ? (
                  <Button variant="ghost" size="sm" className="rounded-full px-3 text-muted-foreground hover:text-foreground" onClick={() => setSelectedDate(null)}>
                    <X data-icon="inline-start" />
                    {t("board.clearDay")}
                  </Button>
                ) : null}
              </div>

              {actionError ? (
                <div className="mt-4 rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {actionError}
                </div>
              ) : null}

              <div className="mt-4 min-h-0 flex-1 overflow-auto">
                <TransactionList
                  transactions={transactionState.transactions}
                  emptyMessage={agendaEmptyMessage}
                  groupByDate={transactionState.groupByDate}
                  renderAction={(transaction) => (
                    <TransactionRowActions
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
              </div>
            </div>
          </Surface>
        </div>
      </div>

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
