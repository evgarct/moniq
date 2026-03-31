import { parseISO } from "date-fns";
import { useFormatter, useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { Badge } from "@/components/ui/badge";
import { getTransactionKindMeta, TransactionKindBadge } from "@/features/transactions/components/transaction-kind-badge";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/finance";

function renderAmount(transaction: Transaction) {
  const primaryAccount = transaction.source_account ?? transaction.destination_account;

  if (!primaryAccount) {
    return null;
  }

  if (transaction.kind === "transfer" || transaction.kind === "save_to_goal" || transaction.kind === "spend_from_goal") {
    return (
      <div className="space-y-1 text-right">
        <MoneyAmount
          amount={transaction.amount}
          currency={transaction.source_account?.currency ?? primaryAccount.currency}
          display="absolute"
          tone="default"
          className="type-body-14 text-foreground"
        />
        {transaction.destination_amount !== null && transaction.destination_account ? (
          <MoneyAmount
            amount={transaction.destination_amount}
            currency={transaction.destination_account.currency}
            display="absolute"
            tone="muted"
            className="type-body-12"
          />
        ) : null}
      </div>
    );
  }

  return (
    <MoneyAmount
      amount={transaction.amount}
      currency={primaryAccount.currency}
      display="absolute"
      tone="default"
      className="type-body-14 text-foreground"
    />
  );
}

export function TransactionRow({
  transaction,
  compact = false,
  variant = "default",
  action,
  className,
}: {
  transaction: Transaction;
  compact?: boolean;
  variant?: "default" | "board";
  action?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("transactions");
  const formatDate = useFormatter();
  const kindMeta = getTransactionKindMeta(transaction.kind);
  const KindIcon = kindMeta.icon;
  const routeLabel =
    transaction.source_account?.name && transaction.destination_account?.name
      ? `${transaction.source_account.name} -> ${transaction.destination_account.name}`
      : transaction.source_account?.name ?? transaction.destination_account?.name ?? t("row.unlinkedAccount");
  const categoryLabel = transaction.category
    ? transaction.category.name
    : transaction.kind === "save_to_goal" || transaction.kind === "spend_from_goal"
      ? transaction.allocation?.name ?? t("row.savingsGoal")
      : transaction.kind === "transfer"
        ? t("kinds.transfer")
          : transaction.kind === "debt_payment"
            ? t("kinds.debt_payment")
            : t("row.uncategorized");
  const primaryAccount = transaction.source_account ?? transaction.destination_account;
  const amountToneClass =
    transaction.kind === "income"
      ? "bg-[#3ad6f4] text-[#083643]"
      : transaction.kind === "transfer" || transaction.kind === "save_to_goal"
        ? "bg-[#f4f6f5] text-[#112831]"
        : "bg-[#ffd229] text-[#17313a]";

  if (variant === "board") {
    return (
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-t border-white/12 px-1 py-3 text-[#f4f8f7]",
          className,
        )}
      >
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/16 bg-white/4 text-[#d7ebe6]">
              <KindIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <p className="truncate text-[14px] font-medium leading-5 text-[#f4f8f7]">{transaction.title}</p>
                {transaction.schedule_id ? (
                  <span className="rounded-full border border-white/14 px-1.5 py-0.5 text-[10px] uppercase tracking-[0.18em] text-[#96b8ba]">
                    {t("row.recurring")}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2">
                <p className="truncate text-[11px] leading-4 text-[#8fb0b1]">
                  {formatDate.dateTime(parseISO(transaction.occurred_at), {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <span className="text-[11px] leading-4 text-[#5f8084]">•</span>
                <p className="truncate text-[11px] leading-4 text-[#8fb0b1]">{categoryLabel}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {action}
          {primaryAccount ? (
            <div className={cn("min-w-[92px] rounded-sm px-3 py-2 text-right text-[14px] font-semibold leading-none", amountToneClass)}>
              <MoneyAmount
                amount={transaction.amount}
                currency={primaryAccount.currency}
                display="absolute"
                tone="default"
                className="text-[14px] font-semibold leading-none text-inherit"
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
        "grid grid-cols-[minmax(0,1fr)_120px_auto] items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3 shadow-none",
        compact &&
          "grid-cols-[minmax(0,1fr)_auto] items-start rounded-none border-x-0 border-t-0 bg-transparent px-0 py-3",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="type-h6 truncate">{transaction.title}</p>
          <TransactionKindBadge kind={transaction.kind} />
          {transaction.schedule_id ? (
            <Badge variant="outline" className="rounded-full px-2.5 py-1 type-body-12">
              {t("row.recurring")}
            </Badge>
          ) : null}
          {transaction.status === "planned" ? (
            <Badge variant="secondary" className="rounded-full px-2.5 py-1 type-body-12">
              {t("form.status.planned")}
            </Badge>
          ) : null}
        </div>
        <p className="type-body-12 truncate">
          {categoryLabel} / {routeLabel}
        </p>
      </div>

      {compact ? null : (
        <p className="type-body-12 text-right">
          {formatDate.dateTime(parseISO(transaction.occurred_at), {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}

      <div className="flex shrink-0 items-center justify-end gap-3">
        {compact ? (
          <p className="type-body-12 text-right">
            {formatDate.dateTime(parseISO(transaction.occurred_at), {
              month: "short",
              day: "numeric",
            })}
          </p>
        ) : null}
        {renderAmount(transaction)}
        {action}
      </div>
    </div>
  );
}
