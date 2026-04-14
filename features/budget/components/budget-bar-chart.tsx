"use client";

import { addMonths, format, isSameMonth, parseISO } from "date-fns";
import { useMemo } from "react";

import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { getIncomeExpenseSummary } from "@/lib/finance-selectors";
import type { Transaction } from "@/types/finance";

const MONTHS_SHOWN = 13;
const BAR_SLOT = 24;
const BAR_WIDTH = 16;
const CHART_H = 72;
const LABEL_H = 14;
const TOTAL_H = CHART_H + LABEL_H;

export function BudgetBarChart({
  transactions,
  currentMonth,
}: {
  transactions: Transaction[];
  currentMonth: Date;
}) {
  const months = useMemo(
    () => Array.from({ length: MONTHS_SHOWN }, (_, i) => addMonths(currentMonth, i - (MONTHS_SHOWN - 1))),
    [currentMonth],
  );

  const bars = useMemo(
    () =>
      months.map((month) => {
        const monthTx = transactions.filter(
          (t) => isSettledTransactionStatus(t.status) && isSameMonth(parseISO(t.occurred_at), month),
        );
        const { income, expenses } = getIncomeExpenseSummary(monthTx);
        const net = income - expenses;
        return { month, net, isCurrent: isSameMonth(month, currentMonth) };
      }),
    [months, transactions, currentMonth],
  );

  const maxAbs = useMemo(() => Math.max(...bars.map((b) => Math.abs(b.net)), 1), [bars]);

  const centerY = CHART_H / 2;
  const maxBarH = centerY - 4;
  const totalWidth = MONTHS_SHOWN * BAR_SLOT;

  return (
    <div className="w-full" style={{ height: TOTAL_H }}>
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${totalWidth} ${TOTAL_H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {/* zero line */}
      <line x1={0} y1={centerY} x2={totalWidth} y2={centerY} stroke="currentColor" strokeOpacity={0.12} strokeWidth={1} className="text-foreground" />

      {bars.map((bar, i) => {
        const cx = i * BAR_SLOT + BAR_SLOT / 2;
        const x = cx - BAR_WIDTH / 2;
        const isPositive = bar.net >= 0;
        const normalised = (Math.abs(bar.net) / maxAbs) * maxBarH;
        const barH = bar.net === 0 ? 2 : Math.max(normalised, 3);
        const y = isPositive ? centerY - barH : centerY;

        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={BAR_WIDTH}
              height={barH}
              rx={3}
              className={
                bar.isCurrent
                  ? isPositive
                    ? "fill-foreground"
                    : "fill-destructive"
                  : bar.net === 0
                    ? "fill-foreground/10"
                    : isPositive
                      ? "fill-foreground/30"
                      : "fill-destructive/30"
              }
            />
            <text
              x={cx}
              y={CHART_H + LABEL_H - 1}
              textAnchor="middle"
              fontSize={9}
              className="fill-muted-foreground"
              fontFamily="inherit"
            >
              {format(bar.month, "MMM")}
            </text>
          </g>
        );
      })}
    </svg>
    </div>
  );
}
