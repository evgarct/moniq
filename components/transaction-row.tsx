import { parseISO } from "date-fns";
import { useFormatter, useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { getTransactionKindMeta } from "@/features/transactions/components/transaction-kind-badge";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/finance";

function renderAmount(transaction: Transaction, showMinorUnits: boolean) {
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
          showMinorUnits={showMinorUnits}
          className="type-body-14 text-foreground"
        />
        {transaction.destination_amount !== null && transaction.destination_account ? (
          <MoneyAmount
            amount={transaction.destination_amount}
            currency={transaction.destination_account.currency}
            display="absolute"
            tone="muted"
            showMinorUnits={showMinorUnits}
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
      showMinorUnits={showMinorUnits}
      className="type-body-14 text-foreground"
    />
  );
}

function buildMetaParts(parts: Array<string | null>) {
  return parts.filter((part, index, source): part is string => Boolean(part) && source.indexOf(part) === index);
}

export function TransactionRow({
  transaction,
  compact = false,
  variant = "default",
  showMinorUnits = true,
  action,
  className,
}: {
  transaction: Transaction;
  compact?: boolean;
  variant?: "default" | "board";
  showMinorUnits?: boolean;
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
  const recurringLabel = transaction.schedule_id ? t("row.recurring") : null;
  const plannedLabel = transaction.status === "planned" ? t("form.status.planned") : null;
  const kindLabel = t(`kinds.${transaction.kind}`);

  if (variant === "board") {
    return (
      <div
        className={cn(
          "grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-t border-white/12 px-1 py-3 text-[#f4f8f7]",
          className,
        )}
      >
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md border border-white/16 bg-white/4 text-[#d7ebe6]">
              <KindIcon className="size-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-medium leading-5 text-[#f4f8f7]">{transaction.title}</p>
              <div className="flex items-center gap-2">
                <p className="truncate text-[11px] leading-4 text-[#8fb0b1]">
                  {formatDate.dateTime(parseISO(transaction.occurred_at), {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <span className="text-[11px] leading-4 text-[#5f8084]">/</span>
                <p className="truncate text-[11px] leading-4 text-[#8fb0b1]">
                  {buildMetaParts([categoryLabel, kindLabel, recurringLabel, plannedLabel]).join(" / ")}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {action}
          {primaryAccount ? (
            <div className="min-w-[110px] text-right">
              <MoneyAmount
                amount={transaction.amount}
                currency={primaryAccount.currency}
                display="absolute"
                tone="default"
                showMinorUnits={showMinorUnits}
                className="text-[14px] font-semibold leading-none text-[#f4f8f7]"
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
        "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 rounded-2xl border border-border/70 bg-card/70 px-4 py-3 shadow-none",
        compact &&
          "grid-cols-[minmax(0,1fr)_auto] items-start rounded-none border-x-0 border-t-0 border-border/60 bg-transparent px-0 py-3",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-sm border border-border/70 bg-background text-muted-foreground">
            <KindIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <p className="type-h6 truncate">{transaction.title}</p>
            <p className="type-body-12 truncate text-muted-foreground">
              {buildMetaParts([kindLabel, categoryLabel, routeLabel, recurringLabel, plannedLabel]).join(" / ")}
            </p>
          </div>
        </div>
      </div>

      {compact ? null : (
        <p className="type-body-12 min-w-[82px] text-right text-muted-foreground">
          {formatDate.dateTime(parseISO(transaction.occurred_at), {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </p>
      )}

      <div className="flex shrink-0 items-center justify-end gap-3">
        {compact ? (
          <p className="type-body-12 text-right text-muted-foreground">
            {formatDate.dateTime(parseISO(transaction.occurred_at), {
              month: "short",
              day: "numeric",
            })}
          </p>
        ) : null}
        {renderAmount(transaction, showMinorUnits)}
        {action}
      </div>
    </div>
  );
}
