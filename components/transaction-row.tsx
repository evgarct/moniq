import { parseISO } from "date-fns";
import { useFormatter, useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { TransactionKindBadge } from "@/features/transactions/components/transaction-kind-badge";
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
  action,
  className,
}: {
  transaction: Transaction;
  compact?: boolean;
  action?: React.ReactNode;
  className?: string;
}) {
  const t = useTranslations("transactions");
  const formatDate = useFormatter();
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

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_100px_160px] items-center gap-4 rounded-2xl border border-border bg-card px-4 py-3 shadow-none",
        compact &&
          "grid-cols-[minmax(0,1fr)_auto] items-start rounded-none border-x-0 border-t-0 bg-transparent px-0 py-3",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="type-h6 truncate">{transaction.title}</p>
          <TransactionKindBadge kind={transaction.kind} />
        </div>
        <p className="type-body-12 truncate">
          {categoryLabel} · {routeLabel}
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
