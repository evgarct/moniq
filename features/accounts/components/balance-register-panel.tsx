"use client";

import { ArrowLeft, Plus, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { TransactionList } from "@/components/transaction-list";
import { PageHeaderIconButton } from "@/components/page-header-icon-button";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { cn } from "@/lib/utils";
import type { Account, Transaction } from "@/types/finance";

type BalanceRegisterHeaderProps = {
  title: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  defaultStartDate?: string;
  onStartDateChange?: (value: string) => void;
  onEndDateChange?: (value: string) => void;
  onClearSelection?: () => void;
  showClearSelection?: boolean;
  onAddTransaction?: () => void;
  onBack?: () => void;
  scrolled?: boolean;
  className?: string;
};

export function BalanceRegisterHeader({
  title,
  description,
  startDate,
  endDate,
  defaultStartDate,
  onStartDateChange,
  onEndDateChange,
  onClearSelection,
  showClearSelection = false,
  onAddTransaction,
  onBack,
  scrolled = false,
  className,
}: BalanceRegisterHeaderProps) {
  const t = useTranslations("accounts");
  const hasDatePicker = Boolean(
    startDate &&
      endDate &&
      defaultStartDate &&
      onStartDateChange &&
      onEndDateChange
  );

  return (
    <div
      className={cn(
        "sticky top-0 z-10 transition-[background-color,border-color,box-shadow] duration-200",
        scrolled
          ? "bg-card/90 backdrop-blur border-b border-border/40 supports-[backdrop-filter]:bg-card/80 lg:bg-background/90 lg:supports-[backdrop-filter]:bg-background/80 shadow-[0_4px_12px_-4px_rgba(28,22,17,0.08)]"
          : "bg-card lg:bg-background border-b border-transparent",
        className,
      )}
    >
      <div className="px-3 pt-4 pb-3 sm:px-6 sm:pt-7 sm:pb-5 lg:px-7 lg:pt-8 lg:pb-6">
        <div className="flex items-center justify-between gap-2 px-1.5 sm:gap-3 sm:px-2.5">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            {onBack ? (
              <PageHeaderIconButton
                icon={ArrowLeft}
                label={t("view.backToBalance")}
                onClick={onBack}
              />
            ) : null}
            <div className="min-w-0 flex-1">
              <h3 className="min-w-0 truncate font-heading text-[28px] leading-none tracking-[-0.035em] text-foreground sm:type-h1">
                {title}
              </h3>
              {description ? (
                <p className="mt-1 truncate type-body-14 text-muted-foreground">
                  {description}
                </p>
              ) : null}
            </div>
            {hasDatePicker && (
              <div className="hidden min-w-0 lg:block">
                <DateRangePicker
                  startDate={startDate!}
                  endDate={endDate!}
                  defaultStartDate={defaultStartDate!}
                  onChange={({ startDate: nextStartDate, endDate: nextEndDate }) => {
                    onStartDateChange!(nextStartDate);
                    onEndDateChange!(nextEndDate);
                  }}
                  triggerAriaLabel={t("view.dateRange")}
                  emptyLabel={t("view.anyDate")}
                  presets={{
                    today: t("view.presets.today"),
                    yesterday: t("view.presets.yesterday"),
                    last7Days: t("view.presets.last7Days"),
                    last14Days: t("view.presets.last14Days"),
                    last30Days: t("view.presets.last30Days"),
                    thisWeek: t("view.presets.thisWeek"),
                    lastWeek: t("view.presets.lastWeek"),
                    thisMonth: t("view.presets.thisMonth"),
                    lastMonth: t("view.presets.lastMonth"),
                  }}
                  className="min-w-0"
                />
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">
            {onAddTransaction ? (
              <PageHeaderIconButton
                icon={Plus}
                label={t("view.addTransaction")}
                onClick={onAddTransaction}
              />
            ) : null}

            {showClearSelection && onClearSelection && !onBack ? (
              <PageHeaderIconButton
                icon={X}
                label={t("view.showAllWallets")}
                onClick={onClearSelection}
              />
            ) : (
              !onBack && <span className="block size-8" aria-hidden="true" />
            )}
          </div>
        </div>
        {hasDatePicker && (
          <div className="mt-2 px-1.5 lg:hidden">
            <DateRangePicker
              startDate={startDate!}
              endDate={endDate!}
              defaultStartDate={defaultStartDate!}
              onChange={({ startDate: nextStartDate, endDate: nextEndDate }) => {
                onStartDateChange!(nextStartDate);
                onEndDateChange!(nextEndDate);
              }}
              triggerAriaLabel={t("view.dateRange")}
              emptyLabel={t("view.anyDate")}
              presets={{
                today: t("view.presets.today"),
                yesterday: t("view.presets.yesterday"),
                last7Days: t("view.presets.last7Days"),
                last14Days: t("view.presets.last14Days"),
                last30Days: t("view.presets.last30Days"),
                thisWeek: t("view.presets.thisWeek"),
                lastWeek: t("view.presets.lastWeek"),
                thisMonth: t("view.presets.thisMonth"),
                lastMonth: t("view.presets.lastMonth"),
              }}
              className="w-full"
              triggerClassName="w-full justify-center bg-secondary/60"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function BalanceRegisterPanel({
  selectedAccount,
  transactions,
  showMinorUnits,
  startDate,
  endDate,
  defaultStartDate,
  onStartDateChange,
  onEndDateChange,
  onClearSelection,
  onAddTransaction,
  onTransactionClick,
  onEditOccurrence,
  onDeleteTransaction,
  onMarkPaid,
  onSkipOccurrence,
  className,
  title,
  emptyMessage,
}: {
  selectedAccount: Account | null;
  transactions: Transaction[];
  showMinorUnits: boolean;
  startDate: string;
  endDate: string;
  defaultStartDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClearSelection?: () => void;
  onAddTransaction?: () => void;
  onTransactionClick?: (transaction: Transaction) => void;
  onEditOccurrence?: (transaction: Transaction) => void;
  onDeleteTransaction?: (transaction: Transaction) => void;
  onMarkPaid?: (transaction: Transaction) => void;
  onSkipOccurrence?: (transaction: Transaction) => void;
  className?: string;
  title?: string;
  emptyMessage?: string;
}) {
  const tr = useTranslations();
  const t = useTranslations("accounts");
  const [scrolled, setScrolled] = useState(false);
  const registerTitle = title ?? (selectedAccount ? selectedAccount.name : t("view.activity"));
  const computedEmptyMessage = emptyMessage ?? (selectedAccount
    ? t("messages.noTransactionsForWallet")
    : tr("common.empty.noTransactionsYet"));

  return (
    <section className={cn("hidden min-h-0 flex-col bg-background lg:flex", className)}>
      <div
        className="min-h-0 flex-1 overflow-auto"
        onScroll={(event) => setScrolled(event.currentTarget.scrollTop > 0)}
      >
        <BalanceRegisterHeader
          title={registerTitle}
          startDate={startDate}
          endDate={endDate}
          defaultStartDate={defaultStartDate}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
          onClearSelection={onClearSelection}
          showClearSelection={Boolean(selectedAccount || title)}
          onAddTransaction={onAddTransaction}
          scrolled={scrolled}
        />

        <div className="px-3 pb-4 pt-2 sm:px-6 sm:pb-5 lg:px-7">
          <TransactionList
            transactions={transactions}
            emptyMessage={computedEmptyMessage}
            groupByDate
            showMinorUnits={showMinorUnits}
            onTransactionClick={onTransactionClick}
            onEditOccurrence={onEditOccurrence}
            onDeleteTransaction={onDeleteTransaction}
            onMarkPaid={onMarkPaid}
            onSkipOccurrence={onSkipOccurrence}
          />
        </div>
      </div>
    </section>
  );
}
