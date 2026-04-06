"use client";

import { ArrowLeft, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import { TransactionList } from "@/components/transaction-list";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Account, Allocation, Transaction } from "@/types/finance";

type BalanceRegisterHeaderProps = {
  title: string;
  startDate: string;
  endDate: string;
  defaultStartDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClearSelection?: () => void;
  showClearSelection?: boolean;
  onBack?: () => void;
  scrolled?: boolean;
  className?: string;
};

export function BalanceRegisterHeader({
  title,
  startDate,
  endDate,
  defaultStartDate,
  onStartDateChange,
  onEndDateChange,
  onClearSelection,
  showClearSelection = false,
  onBack,
  scrolled = false,
  className,
}: BalanceRegisterHeaderProps) {
  const t = useTranslations("accounts");
  const actionButtonClassName =
    "shrink-0 rounded-md bg-transparent text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground active:bg-[#e6e1d9]";

  return (
    <div
      className={cn(
        "sticky top-0 z-10 bg-background/94 backdrop-blur transition-shadow supports-[backdrop-filter]:bg-background/84",
        scrolled && "shadow-[0_10px_24px_-22px_rgba(28,22,17,0.75)]",
        className,
      )}
    >
      <div className="px-3 pt-4 pb-3 sm:px-6 sm:pt-7 sm:pb-5 lg:px-7 lg:pt-8 lg:pb-6">
        <div className="flex items-start justify-between gap-3 px-1.5 sm:items-center sm:px-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {onBack ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={actionButtonClassName}
                aria-label={t("view.backToBalance")}
                onClick={onBack}
              >
                <ArrowLeft />
              </Button>
            ) : null}
            <h3 className="min-w-0 truncate font-heading text-[28px] leading-none tracking-[-0.035em] text-foreground sm:type-h1">
              {title}
            </h3>
            <DateRangePicker
              startDate={startDate}
              endDate={endDate}
              defaultStartDate={defaultStartDate}
              onChange={({ startDate: nextStartDate, endDate: nextEndDate }) => {
                onStartDateChange(nextStartDate);
                onEndDateChange(nextEndDate);
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

          <div className="flex shrink-0 items-center gap-1 sm:gap-2">

            {showClearSelection && onClearSelection ? (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      className={actionButtonClassName}
                      aria-label={t("view.showAllWallets")}
                    />
                  }
                  onClick={onClearSelection}
                >
                  <X />
                </TooltipTrigger>
                <TooltipContent>{t("view.showAllWallets")}</TooltipContent>
              </Tooltip>
            ) : (
              <span className="block size-8" aria-hidden="true" />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export function BalanceRegisterPanel({
  selectedAccount,
  selectedAllocation,
  transactions,
  showMinorUnits,
  startDate,
  endDate,
  defaultStartDate,
  onStartDateChange,
  onEndDateChange,
  onClearSelection,
  onTransactionClick,
  className,
}: {
  selectedAccount: Account | null;
  selectedAllocation: Allocation | null;
  transactions: Transaction[];
  showMinorUnits: boolean;
  startDate: string;
  endDate: string;
  defaultStartDate: string;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onClearSelection?: () => void;
  onTransactionClick?: (transaction: Transaction) => void;
  className?: string;
}) {
  const tr = useTranslations();
  const t = useTranslations("accounts");
  const [scrolled, setScrolled] = useState(false);
  const registerTitle = selectedAllocation ? selectedAllocation.name : selectedAccount ? selectedAccount.name : t("view.activity");
  const emptyMessage = selectedAllocation
    ? t("messages.noTransactionsForGoal")
    : selectedAccount
      ? t("messages.noTransactionsForWallet")
      : tr("common.empty.noTransactionsYet");

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
          showClearSelection={Boolean(selectedAccount || selectedAllocation)}
          scrolled={scrolled}
        />

        <div className="px-3 pb-4 pt-2 sm:px-6 sm:pb-5 lg:px-7">
          <TransactionList
            transactions={transactions}
            emptyMessage={emptyMessage}
            groupByDate
            showMinorUnits={showMinorUnits}
            onTransactionClick={onTransactionClick}
          />
        </div>
      </div>
    </section>
  );
}
