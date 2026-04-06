import { format, parseISO } from "date-fns";
import { useFormatter } from "next-intl";

import { TransactionRow } from "@/components/transaction-row";
import { isVisibleTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import type { Transaction } from "@/types/finance";

export function TransactionList({
  transactions,
  emptyMessage,
  variant = "default",
  showMinorUnits = true,
  groupByDate = false,
  renderAction,
  onTransactionClick,
}: {
  transactions: Transaction[];
  emptyMessage: string;
  variant?: "default" | "board";
  showMinorUnits?: boolean;
  groupByDate?: boolean;
  renderAction?: (transaction: Transaction) => React.ReactNode;
  onTransactionClick?: (transaction: Transaction) => void;
}) {
  const formatDate = useFormatter();
  const visibleTransactions = transactions.filter((transaction) => isVisibleTransactionStatus(transaction.status));

  if (!visibleTransactions.length) {
    return variant === "board" ? (
      <div className="rounded-xl border border-dashed border-white/14 px-4 py-8 text-sm text-[#7fa0a4]">{emptyMessage}</div>
    ) : (
      <div className="type-body-14 rounded-lg border border-dashed border-border px-4 py-8 text-muted-foreground">{emptyMessage}</div>
    );
  }

  if (groupByDate) {
    const groups = visibleTransactions.reduce<Array<{ date: string; items: Transaction[] }>>((acc, transaction) => {
      const dayKey = format(parseISO(transaction.occurred_at), "yyyy-MM-dd");
      const current = acc[acc.length - 1];
      if (current?.date === dayKey) {
        current.items.push(transaction);
      } else {
        acc.push({ date: dayKey, items: [transaction] });
      }
      return acc;
    }, []);

    return (
      <div className={variant === "board" ? "space-y-5" : "space-y-8"}>
        {groups.map((group) => (
          <section key={group.date} className="space-y-1">
            <p className={variant === "board" ? "px-1 text-[11px] leading-4 text-[#8fb0b1]" : "type-body-12 px-1 text-muted-foreground"}>
              {formatDate.dateTime(parseISO(group.date), {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <div className="space-y-1">
              {group.items.map((transaction) => (
                <TransactionRow
                  key={transaction.id}
                  transaction={transaction}
                  variant={variant}
                  showMinorUnits={showMinorUnits}
                  showDate={false}
                  action={renderAction?.(transaction)}
                  onClick={onTransactionClick}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className={variant === "board" ? "space-y-0" : "space-y-1"}>
      {visibleTransactions.map((transaction) => (
        <TransactionRow
          key={transaction.id}
          transaction={transaction}
          variant={variant}
          showMinorUnits={showMinorUnits}
          action={renderAction?.(transaction)}
          onClick={onTransactionClick}
        />
      ))}
    </div>
  );
}
