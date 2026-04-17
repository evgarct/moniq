"use client";

import { useState } from "react";
import { parseISO } from "date-fns";
import { CheckCircle2, Pause, Pencil, Play, SkipForward, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { LedgerAmount } from "@/components/ledger-amount";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getTransactionKindMeta, TransactionKindIndicator } from "@/features/transactions/components/transaction-kind-badge";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/finance";

const INVESTMENT_PATTERN = /\b(invest|investment|investing|broker|brokerage|portfolio|etf|stock|stocks|share|shares|pension)\b/i;

function isEncouragedTransaction(transaction: Transaction) {
  if (transaction.kind === "income" || transaction.kind === "save_to_goal") return true;
  if (transaction.kind !== "expense") return false;
  const haystack = [transaction.title, transaction.category?.name].filter(Boolean).join(" ");
  return INVESTMENT_PATTERN.test(haystack);
}

function renderAmount(transaction: Transaction, showMinorUnits: boolean) {
  const primaryAccount = transaction.source_account ?? transaction.destination_account;
  const kindMeta = getTransactionKindMeta(transaction.kind);

  if (!primaryAccount) return null;

  if (transaction.kind === "transfer" || transaction.kind === "save_to_goal" || transaction.kind === "spend_from_goal") {
    return (
      <div className="inline-grid min-w-[11ch] justify-items-end gap-y-0.5 text-right">
        <div className="flex justify-end">
          <LedgerAmount
            amount={transaction.amount}
            currency={transaction.source_account?.currency ?? primaryAccount.currency}
            display="absolute"
            tone={kindMeta.amountTone}
            showMinorUnits={showMinorUnits}
          />
        </div>
        {transaction.destination_amount !== null && transaction.destination_account ? (
          <div className="relative">
            <span className="type-body-12 absolute right-full top-1/2 mr-1 -translate-y-1/2 text-muted-foreground">→</span>
            <LedgerAmount
              amount={transaction.destination_amount}
              currency={transaction.destination_account.currency}
              display="absolute"
              tone="muted"
              showMinorUnits={showMinorUnits}
              compact
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <LedgerAmount
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
  const base = transaction.category?.name ?? transaction.allocation?.name ?? fallback;
  return transaction.note ? `${base} (${transaction.note})` : base;
}

function buildSecondaryLabel(transaction: Transaction, kindLabel: string, fallback: string) {
  switch (transaction.kind) {
    case "transfer":
      return buildMetaParts([
        transaction.source_account?.name ?? null,
        transaction.destination_account?.name ? `→ ${transaction.destination_account.name}` : null,
      ]).join(" ");
    case "save_to_goal":
      return buildMetaParts([
        transaction.source_account?.name ?? null,
        transaction.allocation?.name ? `→ ${transaction.allocation.name}` : null,
      ]).join(" ");
    case "spend_from_goal":
      return buildMetaParts([
        transaction.allocation?.name ?? null,
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
}) {
  const t = useTranslations("transactions");
  const formatDate = useFormatter();
  const [contextAnchor, setContextAnchor] = useState<{ x: number; y: number } | null>(null);

  const isRecurring = Boolean(transaction.schedule_id && transaction.schedule);
  const isPlanned = transaction.status === "planned";
  const schedulePaused = transaction.schedule?.state === "paused";
  const canMarkPaid = isPlanned && Boolean(onMarkPaid);
  const canSkip = isPlanned && isRecurring && Boolean(onSkipOccurrence);

  const hasContextActions = Boolean(
    onEditOccurrence || onMarkPaid || onDeleteTransaction || onDeleteSeries || onSkipOccurrence,
  );

  const categoryLabel = transaction.category
    ? transaction.category.name
    : transaction.kind === "save_to_goal" || transaction.kind === "spend_from_goal"
      ? transaction.allocation?.name ?? t("row.savingsGoal")
      : transaction.kind === "transfer"
        ? t("kinds.transfer")
        : transaction.kind === "debt_payment"
          ? t("kinds.debt_payment")
          : t("row.uncategorized");

  const primaryLabel = primaryLabelOverride ?? buildPrimaryLabel(transaction, categoryLabel);
  const recurringLabel = transaction.schedule_id ? t("row.recurring") : null;
  const kindLabel = t(`kinds.${transaction.kind}`);
  const secondaryLabel = secondaryLabelOverride ?? buildSecondaryLabel(transaction, kindLabel, t("row.unlinkedAccount"));
  const secondaryMeta = buildMetaParts([secondaryLabel, recurringLabel]).join(" · ");
  const showEncouragementBadge = isEncouragedTransaction(transaction);
  const interactive = Boolean(onClick);

  function activateRow() {
    onClick?.(transaction);
  }

  function handleContextMenu(event: React.MouseEvent) {
    if (!hasContextActions) return;
    event.preventDefault();
    setContextAnchor({ x: event.clientX, y: Math.max(event.clientY - 6, 0) });
  }

  function closeContext() {
    setContextAnchor(null);
  }

  const contextMenu = hasContextActions && contextAnchor ? (
    <DropdownMenu
      open
      onOpenChange={(open) => {
        if (!open) closeContext();
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            className="pointer-events-none fixed h-px w-px min-h-0 min-w-0 p-0 opacity-0"
            style={{ left: contextAnchor.x, top: contextAnchor.y }}
          />
        }
      />
      <DropdownMenuContent align="start" className="w-52 rounded-xl">
        <DropdownMenuGroup>
          {canMarkPaid ? (
            <DropdownMenuItem
              onClick={() => {
                onMarkPaid!(transaction);
                closeContext();
              }}
            >
              <CheckCircle2 />
              {t("actions.markPaid")}
            </DropdownMenuItem>
          ) : null}
          {canSkip ? (
            <DropdownMenuItem
              onClick={() => {
                onSkipOccurrence!(transaction);
                closeContext();
              }}
            >
              <SkipForward />
              {t("actions.skipOccurrence")}
            </DropdownMenuItem>
          ) : null}
          {onEditOccurrence ? (
            <DropdownMenuItem
              onClick={() => {
                onEditOccurrence(transaction);
                closeContext();
              }}
            >
              <Pencil />
              {isRecurring ? t("actions.editOccurrence") : t("actions.edit")}
            </DropdownMenuItem>
          ) : null}
          {isRecurring && onEditSeries ? (
            <DropdownMenuItem
              onClick={() => {
                onEditSeries(transaction);
                closeContext();
              }}
            >
              <Pencil />
              {t("actions.editSeries")}
            </DropdownMenuItem>
          ) : null}
        </DropdownMenuGroup>

        {isRecurring && (onToggleScheduleState || onDeleteSeries) ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {onToggleScheduleState ? (
                <DropdownMenuItem
                  onClick={() => {
                    onToggleScheduleState(transaction);
                    closeContext();
                  }}
                >
                  {schedulePaused ? <Play /> : <Pause />}
                  {schedulePaused ? t("actions.resumeSeries") : t("actions.pauseSeries")}
                </DropdownMenuItem>
              ) : null}
              {onDeleteSeries ? (
                <DropdownMenuItem
                  variant="destructive"
                  onClick={() => {
                    onDeleteSeries(transaction);
                    closeContext();
                  }}
                >
                  <Trash2 />
                  {t("actions.deleteSeries")}
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuGroup>
          </>
        ) : null}

        {!isRecurring && onDeleteTransaction ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => {
                onDeleteTransaction(transaction);
                closeContext();
              }}
            >
              <Trash2 />
              {t("actions.delete")}
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  ) : null;

  if (variant === "board") {
    return (
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-white/12 px-1 py-3 text-[#f4f8f7]",
          interactive && "cursor-pointer rounded-sm transition-[background-color,color] hover:bg-white/4 active:bg-white/7",
          isPlanned && "opacity-70",
          className,
        )}
        onClick={interactive ? activateRow : undefined}
        onContextMenu={handleContextMenu}
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
                  {formatDate.dateTime(parseISO(transaction.occurred_at), { month: "short", day: "numeric" })}
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
              <LedgerAmount
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
        {contextMenu}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex items-center gap-2.5 rounded-md px-2 py-1.5 transition-[background-color] select-none",
        interactive && "cursor-pointer hover:bg-[#f3efe9] active:bg-[#ece8e1]",
        hasContextActions && !interactive && "hover:bg-[#f8f5f1]",
        isPlanned && "opacity-70",
        className,
      )}
      onClick={interactive ? activateRow : undefined}
      onContextMenu={handleContextMenu}
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

      <TransactionKindIndicator kind={transaction.kind} className="shrink-0 text-muted-foreground" />

      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-center gap-2">
          <p className={cn("type-body-14 truncate font-medium leading-5", isPlanned && "italic", primaryLabelClassName)}>
            {primaryLabel}
          </p>
          {showEncouragementBadge ? (
            <span className="shrink-0 rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-emerald-700">
              {t("row.goodMove")}
            </span>
          ) : null}
        </div>
        <p className="type-body-12 truncate text-muted-foreground">{secondaryMeta}</p>
      </div>

      {trailingAccessory ? <div className="shrink-0">{trailingAccessory}</div> : null}

      <div className="shrink-0 text-right">
        <div className="flex justify-end">{renderAmount(transaction, showMinorUnits)}</div>
        {showDate ? (
          <p className="type-body-12 mt-0.5 whitespace-nowrap text-muted-foreground">
            {formatDate.dateTime(parseISO(transaction.occurred_at), {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}

      {contextMenu}
    </div>
  );
}
