import { TransactionRow } from "@/components/transaction-row";
import { isVisibleTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import type { Transaction } from "@/types/finance";

export function TransactionList({
  transactions,
  emptyMessage,
  compact = false,
  variant = "default",
  renderAction,
}: {
  transactions: Transaction[];
  emptyMessage: string;
  compact?: boolean;
  variant?: "default" | "board";
  renderAction?: (transaction: Transaction) => React.ReactNode;
}) {
  const visibleTransactions = transactions.filter((transaction) => isVisibleTransactionStatus(transaction.status));

  if (!visibleTransactions.length) {
    return variant === "board" ? (
      <div className="rounded-xl border border-dashed border-white/14 px-4 py-8 text-sm text-[#7fa0a4]">{emptyMessage}</div>
    ) : (
      <div className="type-body-14 rounded-lg border border-dashed border-border px-4 py-8 text-muted-foreground">{emptyMessage}</div>
    );
  }

  return (
    <div className={variant === "board" ? "space-y-0" : "space-y-3"}>
      {visibleTransactions.map((transaction) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          compact={compact}
          variant={variant}
          action={renderAction?.(transaction)}
        />
      ))}
    </div>
  );
}
