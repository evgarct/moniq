import { format, parseISO } from "date-fns";

import { MoneyAmount } from "@/components/money-amount";
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
        "grid grid-cols-[minmax(0,1fr)_100px_120px] items-center gap-4 rounded-2xl border border-black/5 bg-white px-4 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]",
        compact && "items-start",
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        <p className="truncate text-[14px] font-medium text-slate-900">{transaction.title}</p>
        <p className="text-[12px] text-slate-500">
          {transaction.category.name} · {transaction.account.name}
        </p>
      </div>

      <p className="text-right text-[12px] text-slate-500">{format(parseISO(transaction.date), "MMM d, yyyy")}</p>

      <div className="flex shrink-0 items-center justify-end gap-3">
        <MoneyAmount
          amount={transaction.amount}
          currency={transaction.account.currency}
          display="absolute"
          tone={transaction.type === "income" ? "positive" : "default"}
          className="text-[14px] font-semibold"
        />
        {action}
      </div>
    </div>
  );
}
