"use client";

import { addMonths, format, isBefore, isSameDay, isSameMonth, parseISO, startOfDay, startOfToday } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { CalendarGrid } from "@/components/calendar-grid";
import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { TransactionAddButton } from "@/features/transactions/components/transaction-add-button";
import { TransactionFormSheet, type TransactionFormSubmitPayload } from "@/features/transactions/components/transaction-form-sheet";
import { useTransactionActions } from "@/features/transactions/hooks/use-transaction-actions";
import { isVisibleTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import type { FinanceSnapshot, Transaction } from "@/types/finance";

function sortAscending(transactions: Transaction[]) {
  return [...transactions].sort((a, b) => a.occurred_at.localeCompare(b.occurred_at));
}

export function TodayView({ snapshot }: { snapshot: FinanceSnapshot }) {
  const t = useTranslations("today");
  const transactionViewT = useTranslations("transactions.view");
  const formatDate = useFormatter();
  const today = startOfToday();
  const transactionActions = useTransactionActions();

  const [month, setMonth] = useState(today);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingSeries, setEditingSeries] = useState<Transaction["schedule"] | null>(null);
  const [sheetMode, setSheetMode] = useState<"add" | "edit-transaction" | "edit-schedule">("add");
  const [sheetOpen, setSheetOpen] = useState(false);
  const [initialKind, setInitialKind] = useState<Transaction["kind"]>("expense");
  const [mobileView, setMobileView] = useState<"list" | "calendar">("list");

  const visible = useMemo(
    () => snapshot.transactions.filter((tx) => isVisibleTransactionStatus(tx.status)),
    [snapshot.transactions],
  );

  // Desktop: day or month view
  const { plannedTransactions, paidTransactions } = useMemo(() => {
    if (selectedDate) {
      const dateStr = format(selectedDate, "yyyy-MM-dd");
      return {
        plannedTransactions: sortAscending(visible.filter((tx) => tx.status === "planned" && tx.occurred_at === dateStr)),
        paidTransactions: sortAscending(visible.filter((tx) => tx.status !== "planned" && tx.occurred_at === dateStr)),
      };
    }
    return {
      plannedTransactions: sortAscending(
        visible.filter((tx) => tx.status === "planned" && isSameMonth(parseISO(tx.occurred_at), month)),
      ),
      paidTransactions: sortAscending(
        visible.filter((tx) => tx.status !== "planned" && isSameMonth(parseISO(tx.occurred_at), month)),
      ),
    };
  }, [month, selectedDate, visible]);

  // Mobile list mode: all planned (overdue + upcoming) + today's paid
  const todayStr = format(today, "yyyy-MM-dd");
  const { mobileAllPlanned, mobileTodayPaid } = useMemo(() => ({
    mobileAllPlanned: sortAscending(visible.filter((tx) => tx.status === "planned")),
    mobileTodayPaid: sortAscending(visible.filter((tx) => tx.status !== "planned" && tx.occurred_at === todayStr)),
  }), [visible, todayStr]);

  const initialDate = selectedDate ? format(selectedDate, "yyyy-MM-dd") : null;

  const panelLabel = selectedDate
    ? formatDate.dateTime(selectedDate, { weekday: "long", month: "long", day: "numeric" })
    : formatDate.dateTime(month, { month: "long", year: "numeric" });

  const isEmpty = plannedTransactions.length === 0 && paidTransactions.length === 0;

  // Mobile: when a date is selected, show that day's data; otherwise show full agenda
  const mobileDisplayDate = selectedDate ?? today;
  const mobileListPlanned = selectedDate ? plannedTransactions : mobileAllPlanned;
  const mobileListPaid = selectedDate ? paidTransactions : mobileTodayPaid;
  const mobileListEmpty = mobileListPlanned.length === 0 && mobileListPaid.length === 0;

  function handleSelectDate(date: Date, switchToList?: boolean) {
    const isDeselecting = selectedDate && isSameDay(date, selectedDate);
    if (isDeselecting) {
      setSelectedDate(null);
    } else {
      setSelectedDate(date);
      if (!isSameMonth(date, month)) setMonth(date);
      if (switchToList) setMobileView("list");
    }
  }

  function openAdd(kind: Transaction["kind"]) {
    setInitialKind(kind);
    setSheetMode("add");
    setEditingTransaction(null);
    setEditingSeries(null);
    setSheetOpen(true);
  }

  async function handleSubmit(payload: TransactionFormSubmitPayload) {
    try {
      if (payload.kind === "entry" || payload.kind === "entry-batch") {
        await transactionActions.createEntry(payload.values);
      } else if (payload.kind === "transaction" && editingTransaction) {
        await transactionActions.updateTransaction(editingTransaction.id, payload.values);
        if (payload.rescheduleFrom) {
          await transactionActions.rescheduleFromDate(
            payload.rescheduleFrom.scheduleId,
            payload.rescheduleFrom.originalDate,
            payload.rescheduleFrom.newDate,
          );
        }
      } else if (payload.kind === "schedule" && editingSeries) {
        await transactionActions.updateSchedule(editingSeries.id, payload.values);
      }
      setActionError(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : transactionViewT("saveError"));
      throw error;
    }
  }

  const sharedListProps = {
    onTransactionClick(tx: Transaction) {
      setSheetMode("edit-transaction");
      setEditingTransaction(tx);
      setEditingSeries(null);
      setSheetOpen(true);
    },
    onEditOccurrence(tx: Transaction) {
      setSheetMode("edit-transaction");
      setEditingTransaction(tx);
      setEditingSeries(null);
      setSheetOpen(true);
    },
    onEditSeries(tx: Transaction) {
      if (!tx.schedule) return;
      setSheetMode("edit-schedule");
      setEditingTransaction(tx);
      setEditingSeries(tx.schedule);
      setSheetOpen(true);
    },
    onDeleteTransaction(tx: Transaction) {
      transactionActions.deleteTransactionOptimistic(tx.id);
    },
    async onDeleteSeries(tx: Transaction) {
      if (!tx.schedule_id) return;
      try {
        await transactionActions.deleteSchedule(tx.schedule_id);
        setActionError(null);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : transactionViewT("deleteError"));
      }
    },
    onMarkPaid(tx: Transaction) {
      transactionActions.markPaidOptimistic(tx.id);
    },
    onSkipOccurrence(tx: Transaction) {
      transactionActions.skipOccurrenceOptimistic(tx.id);
    },
    async onToggleScheduleState(tx: Transaction) {
      if (!tx.schedule_id || !tx.schedule) return;
      try {
        await transactionActions.setScheduleState(
          tx.schedule_id,
          tx.schedule.state === "paused" ? "active" : "paused",
        );
        setActionError(null);
      } catch (error) {
        setActionError(error instanceof Error ? error.message : transactionViewT("saveError"));
      }
    },
  };

  const calendarNav = (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-[var(--radius-control)] text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground"
        onClick={() => setMonth((m) => addMonths(m, -1))}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <button
        type="button"
        onClick={() => { setMonth(today); setSelectedDate(null); }}
        className="rounded-[var(--radius-control)] px-2.5 py-1 text-sm font-medium text-foreground transition-colors hover:bg-[#ece8e1]"
      >
        {formatDate.dateTime(month, { month: "long", year: "numeric" })}
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-[var(--radius-control)] text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground"
        onClick={() => setMonth((m) => addMonths(m, 1))}
      >
        <ChevronRight className="size-4" />
      </Button>
    </>
  );

  const calendarGrid = (
    <CalendarGrid
      month={month}
      selectedDate={selectedDate}
      transactions={snapshot.transactions}
      onSelectDate={(date) => handleSelectDate(date)}
    />
  );

  const dayTransactionsList = (
    <>
      {isEmpty ? (
        <div className="flex h-full flex-col items-center justify-center px-6 py-12">
          <EmptyState
            title={selectedDate ? t("board.selectedEmpty") : t("board.empty")}
            description=""
          />
        </div>
      ) : (
        <>
          {plannedTransactions.length > 0 ? (
            <>
              <div className="px-[18px] pb-1 pt-6 sm:px-[34px] lg:px-[38px]">
                <p className="font-heading text-[18px] leading-tight tracking-[-0.022em] text-foreground">{t("board.tabPlanned")}</p>
              </div>
              <div className="px-2.5 pb-4 sm:px-[26px] lg:px-[30px]">
                <TransactionList transactions={plannedTransactions} emptyMessage="" showDate={!selectedDate} groupByDate={!selectedDate} {...sharedListProps} />
              </div>
            </>
          ) : null}
          {paidTransactions.length > 0 ? (
            <div className="px-2.5 pb-4 pt-1 sm:px-[26px] lg:px-[30px]">
              <TransactionList transactions={paidTransactions} emptyMessage="" showDate={!selectedDate} groupByDate={!selectedDate} {...sharedListProps} />
            </div>
          ) : null}
        </>
      )}
    </>
  );

  return (
    <>
      {/* ── Mobile: two-mode layout ──────────────────────────────────────── */}
      <div className="flex h-full flex-col lg:hidden">
        {mobileView === "list" ? (
          <>
            {/* Mobile date header */}
            <PageHeader
              title={formatDate.dateTime(mobileDisplayDate, { weekday: "long", day: "numeric", month: "long" })}
              actions={
                <>
                  {selectedDate ? (
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className="rounded-[var(--radius-control)] text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground"
                      onClick={() => setSelectedDate(null)}
                    >
                      <X className="size-4" />
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-[var(--radius-control)] text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground"
                    onClick={() => setMobileView("calendar")}
                  >
                    <CalendarDays className="size-4" />
                  </Button>
                  <TransactionAddButton onSelect={openAdd} variant="icon" />
                </>
              }
            />

            {actionError ? (
              <div className="mx-5 mt-3 shrink-0 rounded-[var(--radius-control)] border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {mobileListEmpty ? (
                <div className="flex h-full items-center justify-center px-6 py-12">
                  <EmptyState title={t("board.empty")} description="" />
                </div>
              ) : (
                <>
                  {mobileListPlanned.length > 0 ? (
                    <>
                      <div className="px-[18px] pb-1 pt-4 sm:px-[34px]">
                        <p className="type-h5">
                          {t("board.tabPlanned")}
                        </p>
                      </div>
                      <div className="px-2.5 pb-3 sm:px-[26px]">
                        <TransactionList
                          transactions={mobileListPlanned}
                          emptyMessage=""
                          groupByDate={!selectedDate}
                          showDate={false}
                          {...sharedListProps}
                        />
                      </div>
                    </>
                  ) : null}
                  {mobileListPaid.length > 0 ? (
                    <div className="px-2.5 pb-4 pt-1 sm:px-[26px]">
                      <TransactionList
                        transactions={mobileListPaid}
                        emptyMessage=""
                        showDate={false}
                        {...sharedListProps}
                      />
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Mobile calendar header */}
            <div className="shrink-0 flex items-center gap-1 border-b border-border/30 bg-card px-3 py-3">
              <Button
                variant="ghost"
                size="sm"
                className="gap-0.5 rounded-[var(--radius-control)] text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground"
                onClick={() => { setMobileView("list"); setSelectedDate(null); }}
              >
                <ChevronLeft className="size-4" />
                {t("view.title")}
              </Button>
              <div className="flex flex-1 items-center justify-center gap-0.5">
                {calendarNav}
              </div>
              <TransactionAddButton onSelect={openAdd} variant="icon" />
            </div>

            {/* Calendar grid */}
            <div className="shrink-0 border-b border-border/30 bg-card px-4 py-3">
              <CalendarGrid
                month={month}
                selectedDate={selectedDate}
                transactions={snapshot.transactions}
                onSelectDate={(date) => handleSelectDate(date, true)}
              />
            </div>

            {/* Selected day label + clear */}
            {selectedDate ? (
              <div className="shrink-0 flex items-center justify-between border-b border-border/25 px-5 py-2">
                <p className="text-sm font-medium text-foreground truncate">{panelLabel}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  className="shrink-0 rounded-[var(--radius-control)] text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground"
                  onClick={() => setSelectedDate(null)}
                >
                  {t("board.clearDay")}
                </Button>
              </div>
            ) : null}

            {actionError ? (
              <div className="mx-5 mt-3 shrink-0 rounded-[var(--radius-control)] border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {dayTransactionsList}
            </div>
          </>
        )}
      </div>

      {/* ── Desktop: two-column layout ───────────────────────────────────── */}
      <div className="hidden h-full w-full lg:grid lg:grid-cols-[minmax(520px,1.1fr)_minmax(0,1fr)]">

        {/* Left: calendar */}
        <section className="flex min-h-0 flex-col overflow-hidden border-r border-border/40 bg-card">
          <PageHeader
            title={t("view.title")}
            actions={calendarNav}
          />
          <div className="flex-1 overflow-y-auto overscroll-contain px-2.5 pt-4 pb-6 sm:px-[26px] lg:px-[30px]">
            {calendarGrid}
          </div>
        </section>

        {/* Right: planned + paid */}
        <section className="flex min-h-0 flex-col overflow-hidden">
          <PageHeader
            title={panelLabel}
            actions={
              <>
                {selectedDate ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-[var(--radius-control)] text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground"
                    onClick={() => setSelectedDate(null)}
                  >
                    {t("board.clearDay")}
                  </Button>
                ) : null}
                <TransactionAddButton onSelect={openAdd} variant="icon" />
              </>
            }
          />

          {actionError ? (
            <div className="mx-5 mt-3 rounded-[var(--radius-control)] border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {actionError}
            </div>
          ) : null}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {dayTransactionsList}
          </div>
        </section>
      </div>

      <TransactionFormSheet
        open={sheetOpen}
        mode={sheetMode}
        transaction={editingTransaction}
        schedule={editingSeries}
        initialDate={initialDate}
        initialKind={initialKind}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={snapshot.categories}
        onOpenChange={setSheetOpen}
        onSubmit={handleSubmit}
      />
    </>
  );
}
