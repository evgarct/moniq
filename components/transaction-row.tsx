import { BriefcaseBusiness, Coffee, Fuel, GraduationCap, Shirt, UtensilsCrossed } from "lucide-react";
import { format, parseISO } from "date-fns";

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
  const Icon =
    transaction.category.name === "Salary"
      ? BriefcaseBusiness
      : transaction.category.name === "Coffee"
        ? Coffee
        : transaction.category.name === "Fuel"
          ? Fuel
          : transaction.category.name === "Groceries"
            ? UtensilsCrossed
            : transaction.category.name === "Transport"
              ? GraduationCap
              : Shirt;
  const amountTone = transaction.type === "income" ? "bg-cyan-400 text-slate-900" : "bg-amber-400 text-slate-900";

  return (
    <div
      className={cn(
        "grid grid-cols-[minmax(0,1fr)_90px_124px] items-center gap-4 border-b border-white/18 py-3",
        compact && "items-start",
        className,
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-slate-100/90">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0 space-y-0.5">
          <p className="truncate text-[15px] font-semibold text-white">{transaction.title}</p>
          <p className="text-[11px] text-cyan-200/85">{format(parseISO(transaction.date), "MMMM d")}</p>
        </div>
      </div>

      <p className="text-[12px] text-slate-300/85">{format(parseISO(transaction.date), "MMM d")}</p>

      <div className="flex shrink-0 items-center justify-end gap-2">
        <span
          className={cn(
            "min-w-[92px] rounded-[4px] px-3 py-1.5 text-right font-mono text-[15px] font-semibold tabular-nums shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]",
            amountTone,
          )}
        >
          {transaction.account.currency === "USD" ? "$" : ""}
          {transaction.amount.toLocaleString("en-US")}
        </span>
        {action}
      </div>
    </div>
  );
}
