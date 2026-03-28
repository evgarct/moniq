import { TransactionRow } from "@/components/transaction-row";
import type { Transaction } from "@/types/finance";

export function TransactionList({
  transactions,
  emptyMessage,
  compact = false,
  renderAction,
}: {
  transactions: Transaction[];
  emptyMessage: string;
  compact?: boolean;
  renderAction?: (transaction: Transaction) => React.ReactNode;
}) {
  if (!transactions.length) {
    return <div className="py-6 text-[12px] text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <div className="border-t border-border/70">
      {transactions.map((transaction) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          compact={compact}
          action={renderAction?.(transaction)}
        />
      ))}
    </div>
  );
}
