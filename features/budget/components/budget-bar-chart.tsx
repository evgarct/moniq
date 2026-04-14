"use client";

import { addMonths, format, isSameMonth, parseISO } from "date-fns";
import { useMemo } from "react";

import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { getIncomeExpenseSummary } from "@/lib/finance-selectors";
import type { Transaction } from "@/types/finance";

const MONTHS_SHOWN = 13;
const CHART_H = 56;

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

  const totalWidth = MONTHS_SHOWN * 100; // 100 units per slot
  const BAR_WIDTH = 60;
  const centerY = CHART_H / 2;
  const maxBarH = centerY - 6;

  return (
    <div className="w-full">
      {/* Bars — preserveAspectRatio="none" is safe here since there's no text */}
      <div className="w-full" style={{ height: CHART_H }}>
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${totalWidth} ${CHART_H}`}
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* zero line */}
          <line
            x1={0}
            y1={centerY}
            x2={totalWidth}
            y2={centerY}
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
            className="text-foreground"
          />

          {bars.map((bar, i) => {
            const slotCx = i * 100 + 50;
            const x = slotCx - BAR_WIDTH / 2;
            const isPositive = bar.net >= 0;
            const normalised = (Math.abs(bar.net) / maxAbs) * maxBarH;
            const barH = bar.net === 0 ? 2 : Math.max(normalised, 4);
            const y = isPositive ? centerY - barH : centerY;

            return (
              <rect
                key={i}
                x={x}
                y={y}
                width={BAR_WIDTH}
                height={barH}
                rx={4}
                className={
                  bar.isCurrent
                    ? isPositive
                      ? "fill-foreground"
                      : "fill-destructive"
                    : bar.net === 0
                      ? "fill-foreground/10"
                      : isPositive
                        ? "fill-foreground/25"
                        : "fill-destructive/30"
                }
              />
            );
          })}
        </svg>
      </div>

      {/* Month labels in HTML — no SVG text stretching */}
      <div className="flex w-full">
        {bars.map((bar, i) => (
          <div
            key={i}
            className={
              "type-body-12 flex-1 text-center leading-none " +
              (bar.isCurrent ? "font-medium text-foreground" : "")
            }
          >
            {format(bar.month, "MMM")}
          </div>
        ))}
      </div>
    </div>
  );
}
