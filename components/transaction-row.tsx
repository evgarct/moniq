import { format, parseISO } from "date-fns";

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
        "grid grid-cols-[minmax(0,1fr)_88px_120px] items-center gap-4 border-b border-border/70 py-2.5",
        compact && "items-start",
        className,
      )}
    >
      <div className="min-w-0 space-y-0.5">
        <div className="flex items-center gap-2">
          <p className="truncate text-[13px] font-medium text-foreground">{transaction.title}</p>
          <Badge variant="secondary" className="rounded-sm px-1.5 py-0 text-[10px] uppercase tracking-[0.14em]">
            {transaction.status}
          </Badge>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {transaction.category.name} · {transaction.account.name}
        </p>
      </div>

      <p className="text-[12px] text-muted-foreground">{format(parseISO(transaction.date), "MMM d")}</p>

      <div className="flex shrink-0 items-center justify-end gap-2">
        <MoneyAmount
          amount={transaction.amount}
          currency={transaction.account.currency}
          display="absolute"
          tone={transaction.type === "income" ? "positive" : "default"}
          className="text-[15px] font-semibold text-right"
        />
        {action}
      </div>
    </div>
  );
}
