import { format, parseISO } from "date-fns";
import { useFormatter } from "next-intl";

import { TransactionRow } from "@/components/transaction-row";
import { isVisibleTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { calDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/types/finance";

type ActionCallbacks = {
  onEditOccurrence?: (transaction: Transaction) => void;
  onEditSeries?: (transaction: Transaction) => void;
  onDeleteTransaction?: (transaction: Transaction) => void;
  onDeleteSeries?: (transaction: Transaction) => void;
  onMarkPaid?: (transaction: Transaction) => void;
  onSkipOccurrence?: (transaction: Transaction) => void;
  onToggleScheduleState?: (transaction: Transaction) => void;
};

function renderTransactionListItem({
  transaction,
  variant,
  showMinorUnits,
  showDate,
  renderLeadingAction,
  renderTrailingAccessory,
  renderAction,
  renderDetail,
  getRowClassName,
  getPrimaryLabel,
  getPrimaryLabelClassName,
  getSecondaryLabel,
  onTransactionClick,
  actionCallbacks,
}: {
  transaction: Transaction;
  variant: "default" | "board";
  showMinorUnits: boolean;
  showDate: boolean;
  renderLeadingAction?: (transaction: Transaction) => React.ReactNode;
  renderTrailingAccessory?: (transaction: Transaction) => React.ReactNode;
  renderAction?: (transaction: Transaction) => React.ReactNode;
  renderDetail?: (transaction: Transaction) => React.ReactNode;
  getRowClassName?: (transaction: Transaction) => string | undefined;
  getPrimaryLabel?: (transaction: Transaction) => string | undefined;
  getPrimaryLabelClassName?: (transaction: Transaction) => string | undefined;
  getSecondaryLabel?: (transaction: Transaction) => string | undefined;
  onTransactionClick?: (transaction: Transaction) => void;
  actionCallbacks: ActionCallbacks;
}) {
  const detail = renderDetail?.(transaction);

  return (
    <div key={transaction.id}>
      <TransactionRow
        transaction={transaction}
        variant={variant}
        showMinorUnits={showMinorUnits}
        showDate={showDate}
        leadingAction={renderLeadingAction?.(transaction)}
        trailingAccessory={renderTrailingAccessory?.(transaction)}
        action={renderAction?.(transaction)}
        className={getRowClassName?.(transaction)}
        primaryLabelOverride={getPrimaryLabel?.(transaction)}
        primaryLabelClassName={getPrimaryLabelClassName?.(transaction)}
        secondaryLabelOverride={getSecondaryLabel?.(transaction)}
        onClick={onTransactionClick}
        onEditOccurrence={actionCallbacks.onEditOccurrence}
        onEditSeries={actionCallbacks.onEditSeries}
        onDeleteTransaction={actionCallbacks.onDeleteTransaction}
        onDeleteSeries={actionCallbacks.onDeleteSeries}
        onMarkPaid={actionCallbacks.onMarkPaid}
        onSkipOccurrence={actionCallbacks.onSkipOccurrence}
        onToggleScheduleState={actionCallbacks.onToggleScheduleState}
      />
      {detail}
    </div>
  );
}

export function TransactionList({
  transactions,
  emptyMessage,
  variant = "default",
  showMinorUnits = true,
  groupByDate = false,
  showDate,
  renderLeadingAction,
  renderTrailingAccessory,
  renderAction,
  renderDetail,
  getRowClassName,
  getPrimaryLabel,
  getPrimaryLabelClassName,
  getSecondaryLabel,
  onTransactionClick,
  onEditOccurrence,
  onEditSeries,
  onDeleteTransaction,
  onDeleteSeries,
  onMarkPaid,
  onSkipOccurrence,
  onToggleScheduleState,
}: {
  transactions: Transaction[];
  emptyMessage: string;
  variant?: "default" | "board";
  showMinorUnits?: boolean;
  groupByDate?: boolean;
  showDate?: boolean;
  renderLeadingAction?: (transaction: Transaction) => React.ReactNode;
  renderTrailingAccessory?: (transaction: Transaction) => React.ReactNode;
  renderAction?: (transaction: Transaction) => React.ReactNode;
  renderDetail?: (transaction: Transaction) => React.ReactNode;
  getRowClassName?: (transaction: Transaction) => string | undefined;
  getPrimaryLabel?: (transaction: Transaction) => string | undefined;
  getPrimaryLabelClassName?: (transaction: Transaction) => string | undefined;
  getSecondaryLabel?: (transaction: Transaction) => string | undefined;
  onTransactionClick?: (transaction: Transaction) => void;
} & ActionCallbacks) {
  const formatDate = useFormatter();
  const visibleTransactions = transactions.filter((transaction) => isVisibleTransactionStatus(transaction.status));
  const actionCallbacks: ActionCallbacks = {
    onEditOccurrence,
    onEditSeries,
    onDeleteTransaction,
    onDeleteSeries,
    onMarkPaid,
    onSkipOccurrence,
    onToggleScheduleState,
  };

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
      <div className={variant === "board" ? "space-y-5" : "space-y-4"}>
        {groups.map((group) => (
          <section key={group.date} className="space-y-1">
            <p className={variant === "board" ? "px-1 text-[11px] leading-4 text-[#8fb0b1]" : "type-body-12 px-2 text-muted-foreground"}>
              {formatDate.dateTime(calDate(group.date), {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </p>
            <div className="space-y-0">
              {group.items.map((transaction) =>
                renderTransactionListItem({
                  transaction,
                  variant,
                  showMinorUnits,
                  showDate: false,
                  renderLeadingAction,
                  renderTrailingAccessory,
                  renderAction,
                  renderDetail,
                  getRowClassName,
                  getPrimaryLabel,
                  getPrimaryLabelClassName,
                  getSecondaryLabel,
                  onTransactionClick,
                  actionCallbacks,
                }),
              )}
            </div>
          </section>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {visibleTransactions.map((transaction) =>
        renderTransactionListItem({
          transaction,
          variant,
          showMinorUnits,
          showDate: showDate ?? true,
          renderLeadingAction,
          renderTrailingAccessory,
          renderAction,
          renderDetail,
          getRowClassName,
          getPrimaryLabel,
          getPrimaryLabelClassName,
          getSecondaryLabel,
          onTransactionClick,
          actionCallbacks,
        }),
      )}
    </div>
  );
}
