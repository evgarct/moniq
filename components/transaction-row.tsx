import { parseISO } from "date-fns";
import { useFormatter, useTranslations } from "next-intl";

import { LedgerAmount } from "@/components/ledger-amount";
import { getTransactionKindMeta, TransactionKindIndicator } from "@/features/transactions/components/transaction-kind-badge";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/finance";

const INVESTMENT_PATTERN = /\b(invest|investment|investing|broker|brokerage|portfolio|etf|stock|stocks|share|shares|pension)\b/i;

function isEncouragedTransaction(transaction: Transaction) {
  if (transaction.kind === "income") {
    return true;
  }

  if (transaction.kind === "save_to_goal") {
    return true;
  }

  if (transaction.kind !== "expense") {
    return false;
  }

  const haystack = [transaction.title, transaction.category?.name].filter(Boolean).join(" ");
  return INVESTMENT_PATTERN.test(haystack);
}

function renderAmount(transaction: Transaction, showMinorUnits: boolean) {
  const primaryAccount = transaction.source_account ?? transaction.destination_account;
  const kindMeta = getTransactionKindMeta(transaction.kind);

  if (!primaryAccount) {
    return null;
  }

  if (transaction.kind === "transfer" || transaction.kind === "save_to_goal" || transaction.kind === "spend_from_goal") {
    return (
      <div className="inline-grid min-w-[13ch] justify-items-end gap-y-0.5 text-right">
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
            <div className="flex justify-end">
              <LedgerAmount
                amount={transaction.destination_amount}
                currency={transaction.destination_account.currency}
                display="absolute"
                tone="muted"
                showMinorUnits={showMinorUnits}
                compact
              />
            </div>
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
  const base =
    transaction.category?.name ??
    transaction.allocation?.name ??
    fallback;

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
    case "income":
    case "expense":
    case "debt_payment":
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
}) {
  const t = useTranslations("transactions");
  const formatDate = useFormatter();
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
  const primaryAccount = transaction.source_account ?? transaction.destination_account;
  const recurringLabel = transaction.schedule_id ? t("row.recurring") : null;
  const kindLabel = t(`kinds.${transaction.kind}`);
  const secondaryLabel = secondaryLabelOverride ?? buildSecondaryLabel(transaction, kindLabel, t("row.unlinkedAccount"));
  const showEncouragementBadge = isEncouragedTransaction(transaction);
  const interactive = Boolean(onClick);

  function activateRow() {
    onClick?.(transaction);
  }

  if (variant === "board") {
    return (
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-white/12 px-1 py-3 text-[#f4f8f7]",
          interactive && "cursor-pointer rounded-sm transition-[background-color,color] hover:bg-white/4 active:bg-white/7",
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
                  {formatDate.dateTime(parseISO(transaction.occurred_at), {
                    month: "short",
                    day: "numeric",
                  })}
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
          {primaryAccount ? (
            <div className="min-w-[110px] text-right">
              <LedgerAmount
                amount={transaction.amount}
                currency={primaryAccount.currency}
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

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 rounded-sm bg-transparent px-2 py-1 shadow-none transition-[background-color,color]",
        interactive && "cursor-pointer px-3 py-2 hover:bg-[#f3efe9] active:bg-[#ece8e1]",
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
        <div className="flex items-center gap-2">
          {leadingAction ? <div className="shrink-0">{leadingAction}</div> : null}
          <TransactionKindIndicator kind={transaction.kind} className="shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1 space-y-0">
            <div className="flex min-w-0 items-center gap-2">
              <p className={cn("type-body-14 truncate font-medium", primaryLabelClassName)}>{primaryLabel}</p>
              {showEncouragementBadge ? (
                <span className="shrink-0 rounded-sm bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium leading-none text-emerald-700">
                  {t("row.goodMove")}
                </span>
              ) : null}
            </div>
            <p className="type-body-12 truncate text-muted-foreground">
              {buildMetaParts([secondaryLabel, recurringLabel]).join(" / ")}
            </p>
          </div>
        </div>
      </div>

      {!showDate ? null : (
        <p className="type-body-12 min-w-[82px] self-center text-right text-muted-foreground">
          {formatDate.dateTime(parseISO(transaction.occurred_at), {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}

      <div className="grid shrink-0 grid-cols-[376px_140px_104px] items-center justify-end gap-6 self-center">
        <div className="min-w-0">{trailingAccessory}</div>
        <div className="min-w-0 justify-self-end">{renderAmount(transaction, showMinorUnits)}</div>
        <div className="min-w-0 justify-self-end">{action}</div>
      </div>
    </div>
  );
}
