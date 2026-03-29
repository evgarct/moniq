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
    return <div className="type-body-14 rounded-lg border border-dashed border-border px-4 py-8 text-muted-foreground">{emptyMessage}</div>;
  }

  return (
    <div className="space-y-3">
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
