"use client";

import { useRef } from "react";
import { isBefore, parseISO, startOfDay, startOfToday } from "date-fns";
import { CheckCircle2, Pause, Pencil, Play, Repeat, SkipForward, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

import { MoneyAmount } from "@/components/money-amount";
import { convertMoney } from "@/features/finance/lib/exchange-rates";
import { getTransactionKindMeta, TransactionKindIndicator } from "@/features/transactions/components/transaction-kind-badge";
import { calDate, formatMoneyNumber, getCurrencySymbol } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";
import type { ExchangeRate, Transaction } from "@/types/finance";

function isEncouragedTransaction(transaction: Transaction) {
  return transaction.kind === "income";
}

function renderAmount(
  transaction: Transaction,
  showMinorUnits: boolean,
  targetCurrency?: CurrencyCode,
  exchangeRates?: ExchangeRate[],
) {
  const primaryAccount = transaction.source_account ?? transaction.destination_account;
  const kindMeta = getTransactionKindMeta(transaction.kind);

  if (!primaryAccount) return null;

  if (targetCurrency && exchangeRates) {
    const conversion = convertMoney({
      amount: transaction.amount,
      sourceCurrency: primaryAccount.currency,
      targetCurrency,
      requestedDate: transaction.occurred_at,
      exchangeRates,
    });
    return (
      <MoneyAmount
        amount={conversion.amount}
        currency={targetCurrency}
        display="absolute"
        tone={kindMeta.amountTone}
        showMinorUnits={showMinorUnits}
      />
    );
  }

  if (transaction.kind === "transfer") {
    const primaryCurrency = transaction.source_account?.currency ?? primaryAccount.currency;
    const primaryToneClass =
      kindMeta.amountTone === "positive"
        ? "text-emerald-600"
        : kindMeta.amountTone === "negative"
          ? "text-destructive"
          : "text-foreground";
    const hasFxRow = transaction.destination_amount !== null && transaction.destination_account != null;

    return (
      // Single shared grid — both rows use the same column widths so number
      // and currency symbol stay perfectly aligned regardless of font-size difference.
      <span className="inline-grid grid-cols-[minmax(0,max-content)_2.25ch] items-baseline justify-end gap-x-[0.35em] gap-y-0.5">
        {/* Row 1 — primary amount */}
        <span className={cn("justify-self-end tabular-nums whitespace-nowrap tracking-[-0.025em]", primaryToneClass)}>
          {formatMoneyNumber(transaction.amount, primaryCurrency, { showMinorUnits })}
        </span>
        <span className={cn("justify-self-center text-[0.8em] opacity-70", primaryToneClass)}>
          {getCurrencySymbol(primaryCurrency)}
        </span>

        {/* Row 2 — destination amount when FX conversion */}
        {hasFxRow ? (
          <>
            <span className="relative justify-self-end tabular-nums whitespace-nowrap tracking-[-0.025em] text-[0.86em] text-muted-foreground">
              <span className="absolute right-full top-1/2 mr-1 -translate-y-1/2 select-none" aria-hidden>→</span>
              {formatMoneyNumber(transaction.destination_amount!, transaction.destination_account!.currency, { showMinorUnits })}
            </span>
            <span className="justify-self-center text-[0.69em] opacity-70 text-muted-foreground">
              {getCurrencySymbol(transaction.destination_account!.currency)}
            </span>
          </>
        ) : null}
      </span>
    );
  }

  return (
    <MoneyAmount
      amount={transaction.amount}
      currency={primaryAccount.currency}
      display="absolute"
      tone={kindMeta.amountTone}
      showMinorUnits={showMinorUnits}
    />
  );
}

function buildMetaParts(parts: Array<string | null>) {
  return parts.filter((part, index, source): part is string => Boolean(part) && source.indexOf(part) === index);
}

function buildPrimaryLabel(transaction: Transaction, fallback: string) {
  const base = transaction.category?.name ?? fallback;
  return transaction.note ? `${base} (${transaction.note})` : base;
}

function buildSecondaryLabel(transaction: Transaction, kindLabel: string, fallback: string) {
  switch (transaction.kind) {
    case "transfer":
      return buildMetaParts([
        transaction.source_account?.name ?? null,
        transaction.destination_account?.name ? `→ ${transaction.destination_account.name}` : null,
      ]).join(" ");
    default:
      return transaction.source_account?.name ?? transaction.destination_account?.name ?? fallback ?? kindLabel;
  }
}

export function TransactionRow({
  transaction,
  variant = "default",
  showMinorUnits = true,
  leadingAction,
  trailingAccessory,
  action,
  className,
  showDate = true,
  primaryLabelOverride,
  primaryLabelClassName,
  secondaryLabelOverride,
  onClick,
  onEditOccurrence,
  onEditSeries,
  onDeleteTransaction,
  onDeleteSeries,
  onMarkPaid,
  onSkipOccurrence,
  onToggleScheduleState,
  targetCurrency,
  exchangeRates,
}: {
  transaction: Transaction;
  variant?: "default" | "board";
  showMinorUnits?: boolean;
  leadingAction?: React.ReactNode;
  trailingAccessory?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  showDate?: boolean;
  primaryLabelOverride?: string;
  primaryLabelClassName?: string;
  secondaryLabelOverride?: string;
  onClick?: (transaction: Transaction) => void;
  onEditOccurrence?: (transaction: Transaction) => void;
  onEditSeries?: (transaction: Transaction) => void;
  onDeleteTransaction?: (transaction: Transaction) => void;
  onDeleteSeries?: (transaction: Transaction) => void;
  onMarkPaid?: (transaction: Transaction) => void;
  onSkipOccurrence?: (transaction: Transaction) => void;
  onToggleScheduleState?: (transaction: Transaction) => void;
  targetCurrency?: CurrencyCode;
  exchangeRates?: ExchangeRate[];
}) {
  const t = useTranslations("transactions");
  const investmentsT = useTranslations("investments");
  const formatDate = useFormatter();
  const suppressClickUntil = useRef(0);

  const isRecurring = Boolean(transaction.schedule_id && transaction.schedule);
  const isPlanned = transaction.status === "planned";
  const isOverdue = isPlanned && isBefore(startOfDay(parseISO(transaction.occurred_at)), startOfToday());
  const schedulePaused = transaction.schedule?.state === "paused";
  const canMarkPaid = isPlanned && Boolean(onMarkPaid);
  const canSkip = isPlanned && isRecurring && Boolean(onSkipOccurrence);

  const hasContextActions = Boolean(
    onEditOccurrence || onMarkPaid || onDeleteTransaction || onDeleteSeries || onSkipOccurrence,
  );

  const categoryLabel = transaction.category
    ? transaction.category.name
    : transaction.kind === "transfer"
        ? t("kinds.transfer")
        : transaction.kind === "debt_payment"
          ? t("kinds.debt_payment")
          : t("row.uncategorized");

  const primaryLabel = primaryLabelOverride ?? buildPrimaryLabel(transaction, categoryLabel);
  const recurringLabel = transaction.schedule_id ? t("row.recurring") : null;
  const kindLabel = t(`kinds.${transaction.kind}`);
  const secondaryLabel = secondaryLabelOverride ?? buildSecondaryLabel(transaction, kindLabel, t("row.unlinkedAccount"));
  const secondaryMeta = transaction.investment_instrument && transaction.investment_units
    ? `${secondaryLabel} · ${transaction.investment_instrument.ticker} · ${investmentsT("units", { value: String(transaction.investment_units) })}`
    : secondaryLabel;
  const showEncouragementBadge = isEncouragedTransaction(transaction);
  const interactive = Boolean(onClick);

  function activateRow() {
    if (Date.now() < suppressClickUntil.current) return;
    onClick?.(transaction);
  }

  function withContextMenu(row: React.ReactElement) {
    if (!hasContextActions) return row;
    return (
      <ContextMenu
        onOpenChange={(open) => {
          if (open) suppressClickUntil.current = Date.now() + 700;
        }}
      >
        <ContextMenuTrigger render={row} />
        <ContextMenuContent className="min-w-52 rounded-[var(--radius-floating)]">
            {canMarkPaid ? (
              <ContextMenuItem onClick={() => onMarkPaid!(transaction)}>
                <CheckCircle2 />
                {t("actions.markPaid")}
              </ContextMenuItem>
            ) : null}
            {canSkip ? (
              <ContextMenuItem onClick={() => onSkipOccurrence!(transaction)}>
                <SkipForward />
                {t("actions.skipOccurrence")}
              </ContextMenuItem>
            ) : null}
            {onEditOccurrence ? (
              <ContextMenuItem onClick={() => onEditOccurrence(transaction)}>
                <Pencil />
                {isRecurring ? t("actions.editOccurrence") : t("actions.edit")}
              </ContextMenuItem>
            ) : null}
            {isRecurring && onEditSeries ? (
              <ContextMenuItem onClick={() => onEditSeries(transaction)}>
                <Pencil />
                {t("actions.editSeries")}
              </ContextMenuItem>
            ) : null}

            {isRecurring && (onToggleScheduleState || onDeleteSeries) ? (
              <>
                <ContextMenuSeparator />
                {onToggleScheduleState ? (
                  <ContextMenuItem onClick={() => onToggleScheduleState(transaction)}>
                    {schedulePaused ? <Play /> : <Pause />}
                    {schedulePaused ? t("actions.resumeSeries") : t("actions.pauseSeries")}
                  </ContextMenuItem>
                ) : null}
                {onDeleteSeries ? (
                  <ContextMenuItem variant="destructive" onClick={() => onDeleteSeries(transaction)}>
                    <Trash2 />
                    {t("actions.deleteSeries")}
                  </ContextMenuItem>
                ) : null}
              </>
            ) : null}

            {!isRecurring && onDeleteTransaction ? (
              <>
                <ContextMenuSeparator />
                <ContextMenuItem variant="destructive" onClick={() => onDeleteTransaction(transaction)}>
                  <Trash2 />
                  {t("actions.delete")}
                </ContextMenuItem>
              </>
            ) : null}
        </ContextMenuContent>
      </ContextMenu>
    );
  }

  if (variant === "board") {
    return withContextMenu(
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-white/12 px-1 py-3 text-[#f4f8f7]",
          interactive && "cursor-pointer rounded-sm transition-[background-color,color] hover:bg-white/4 active:bg-white/7",
          isPlanned && "opacity-70",
          className,
        )}
        onClick={interactive ? activateRow : undefined}
        onKeyDown={
          interactive
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  activateRow();
                }
              }
            : undefined
        }
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
      >
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <TransactionKindIndicator kind={transaction.kind} className="mt-[3px] size-4 text-[#d7ebe6]" />
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium leading-5 text-[#f4f8f7]">{primaryLabel}</p>
              <div className="flex items-center gap-2">
                <p className="truncate text-[11px] leading-4 text-[#8fb0b1]">
                  {formatDate.dateTime(calDate(transaction.occurred_at), { month: "short", day: "numeric" })}
                </p>
                <span className="text-[11px] leading-4 text-[#5f8084]">/</span>
                <p className="truncate text-[11px] leading-4 text-[#8fb0b1]">
                  {buildMetaParts([kindLabel, categoryLabel, recurringLabel]).join(" / ")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {action}
          {transaction.source_account ?? transaction.destination_account ? (
            <div className="min-w-[110px] text-right">
              <MoneyAmount
                amount={transaction.amount}
                currency={(transaction.source_account ?? transaction.destination_account)!.currency}
                display="absolute"
                tone="default"
                showMinorUnits={showMinorUnits}
                className="text-[#f4f8f7]"
              />
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return withContextMenu(
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-[var(--radius-control)] px-2 py-1.5 transition-[background-color] select-none",
        interactive && "cursor-pointer hover:bg-secondary/50 active:bg-secondary/70",
        hasContextActions && !interactive && "hover:bg-secondary/30",
        isPlanned && "opacity-70",
        className,
      )}
      onClick={interactive ? activateRow : undefined}
      onKeyDown={
        interactive
          ? (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activateRow();
              }
            }
          : undefined
      }
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
    >
      {leadingAction ? <div className="shrink-0">{leadingAction}</div> : null}

      <TransactionKindIndicator kind={transaction.kind} className="shrink-0 self-start mt-[3px] text-muted-foreground" />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className={cn("type-body-14 truncate font-medium leading-5", isPlanned && "italic", primaryLabelClassName)}>
            {primaryLabel}
          </p>
          {isOverdue ? (
            <span className="shrink-0 rounded-[var(--radius-tight)] bg-destructive/10 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-destructive">
              {t("row.overdue")}
            </span>
          ) : showEncouragementBadge ? (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger render={<span className="shrink-0 cursor-default text-[13px] leading-none" />}>
                  ✨
                </TooltipTrigger>
                <TooltipContent side="top">{t("row.goodMove")}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          ) : null}
        </div>
        <p className="type-body-12 truncate text-muted-foreground">{secondaryMeta}</p>
      </div>

      {trailingAccessory ? <div className="shrink-0">{trailingAccessory}</div> : null}

      <div className="flex shrink-0 items-center gap-1.5">
        {isRecurring && transaction.schedule ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-default" />
                }
              >
                <Repeat className="size-3" />
              </TooltipTrigger>
              <TooltipContent side="top">
                {[
                  t(`form.recurrence.${transaction.schedule.frequency}`),
                  transaction.schedule.until_date
                    ? `${formatDate.dateTime(calDate(transaction.schedule.start_date), { month: "short", year: "numeric" })} – ${formatDate.dateTime(calDate(transaction.schedule.until_date), { month: "short", year: "numeric" })}`
                    : `${t("row.from")} ${formatDate.dateTime(calDate(transaction.schedule.start_date), { month: "short", year: "numeric" })}`,
                ].join(" · ")}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : null}
        <div className="text-right">
          <div className="flex justify-end">{renderAmount(transaction, showMinorUnits, targetCurrency, exchangeRates)}</div>
          {showDate ? (
            <p className="type-body-12 mt-0.5 whitespace-nowrap text-muted-foreground">
              {formatDate.dateTime(calDate(transaction.occurred_at), {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
          ) : null}
        </div>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}

    </div>
  );
}
