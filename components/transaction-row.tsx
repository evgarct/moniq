import { format } from "date-fns";

import { MoneyAmount } from "@/components/money-amount";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/finance";

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
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-lg border border-border px-3 py-3",
        compact && "items-start",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <p className="truncate font-medium text-foreground">{transaction.title}</p>
          <Badge variant="secondary" className="rounded-full">
            {transaction.status}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {transaction.category.name} · {transaction.account.name} · {format(new Date(transaction.date), "MMM d")}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        <MoneyAmount
          amount={transaction.amount}
          currency={transaction.account.currency}
          display="absolute"
          tone={transaction.type === "income" ? "positive" : "default"}
          className="text-sm"
        />
        {action}
      </div>
    </div>
  );
}
