"use client";

import { addMonths, isSameMonth, parseISO, startOfToday } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { BudgetBarChart } from "@/features/budget/components/budget-bar-chart";
import { CategoryIcon } from "@/components/category-icon";
import { MoneyAmount } from "@/components/money-amount";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { getCategoryDescendantIds } from "@/features/categories/lib/category-tree";
import { buildCategoryTree } from "@/features/categories/lib/category-tree";
import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { cn } from "@/lib/utils";
import type { CategoryTreeNode, FinanceSnapshot, Transaction } from "@/types/finance";

function sortNodesByActivity(nodes: CategoryTreeNode[]) {
  return [...nodes].sort((a, b) => Math.abs(b.total_amount) - Math.abs(a.total_amount));
}

// ─── Category tile ────────────────────────────────────────────────────────────

function CategoryTile({
  node,
  isSelected,
  onClick,
}: {
  node: CategoryTreeNode;
  isSelected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-md px-2 py-3 text-center transition-colors focus:outline-none",
        "hover:bg-secondary/50",
        isSelected && "bg-secondary/60",
      )}
    >
      <CategoryIcon icon={node.icon} glyphClassName="size-[18px] text-muted-foreground" />
      <div className="w-full min-w-0">
        <p className="type-body-12 truncate font-medium leading-tight text-foreground">{node.name}</p>
        {node.totals_by_currency.length ? (
          <div className="mt-0.5 flex flex-col items-center">
            {node.totals_by_currency.map((total) => (
              <MoneyAmount
                key={total.currency}
                amount={total.amount}
                currency={total.currency}
                display="absolute"
                className="type-body-12 text-muted-foreground tabular-nums"
              />
            ))}
          </div>
        ) : (
          <span className="type-body-12 mt-0.5 text-muted-foreground">—</span>
        )}
      </div>
    </button>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  title,
  nodes,
}: {
  title: string;
  nodes: CategoryTreeNode[];
}) {
  const totals = useMemo(
    () =>
      nodes
        .flatMap((n) => n.totals_by_currency)
        .reduce<{ currency: string; amount: number }[]>((acc, t) => {
          const existing = acc.find((x) => x.currency === t.currency);
          if (existing) existing.amount += t.amount;
          else acc.push({ ...t });
          return acc;
        }, []),
    [nodes],
  );

  return (
    <div className="flex shrink-0 items-center justify-between py-3">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <div className="flex gap-3">
        {totals.map((total) => (
          <MoneyAmount
            key={total.currency}
            amount={total.amount}
            currency={total.currency}
            display="absolute"
            className="type-body-12 font-semibold tabular-nums text-foreground"
          />
        ))}
      </div>
    </div>
  );
}

// ─── Category detail ──────────────────────────────────────────────────────────

function CategoryDetail({
  node,
  transactions,
  emptyMessage,
}: {
  node: CategoryTreeNode;
  transactions: Transaction[];
  emptyMessage: string;
}) {
  const sortedChildren = sortNodesByActivity(node.children);

  return (
    <div>
      <div className="mb-4 flex items-center gap-3">
        <CategoryIcon icon={node.icon} glyphClassName="size-[18px] text-muted-foreground" />
        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <p className="type-body-14 font-medium text-foreground">{node.name}</p>
          {node.totals_by_currency.length ? (
            <div className="flex gap-3">
              {node.totals_by_currency.map((total) => (
                <MoneyAmount
                  key={total.currency}
                  amount={total.amount}
                  currency={total.currency}
                  display="absolute"
                  className="text-sm font-semibold tabular-nums text-foreground"
                />
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {sortedChildren.length > 0 && (
        <div className="mb-4 flex flex-col">
          {sortedChildren.map((child, i) => (
            <div
              key={child.id}
              className={cn("flex items-center gap-3 py-2", i > 0 && "border-t border-border/40")}
            >
              <CategoryIcon icon={child.icon} glyphClassName="size-4 text-muted-foreground" />
              <p className="min-w-0 flex-1 truncate text-sm text-foreground">{child.name}</p>
              {child.totals_by_currency.length ? (
                <div className="flex gap-3">
                  {child.totals_by_currency.map((total) => (
                    <MoneyAmount
                      key={total.currency}
                      amount={total.amount}
                      currency={total.currency}
                      display="absolute"
                      className="text-sm tabular-nums text-muted-foreground"
                    />
                  ))}
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">—</span>
              )}
            </div>
          ))}
        </div>
      )}

      <TransactionList
        transactions={transactions}
        emptyMessage={emptyMessage}
        groupByDate
        showMinorUnits
      />
    </div>
  );
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function BudgetView({ snapshot }: { snapshot: FinanceSnapshot }) {
  const t = useTranslations("budget");
  const formatDate = useFormatter();
  const today = startOfToday();
  const [month, setMonth] = useState(today);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);

  const monthTransactions = useMemo(
    () =>
      snapshot.transactions.filter(
        (tx) => isSettledTransactionStatus(tx.status) && isSameMonth(parseISO(tx.occurred_at), month),
      ),
    [month, snapshot.transactions],
  );

  const categoryTree = useMemo(
    () => buildCategoryTree(snapshot.categories, monthTransactions),
    [monthTransactions, snapshot.categories],
  );

  const expenseNodes = useMemo(
    () => sortNodesByActivity(categoryTree.filter((node) => node.type === "expense")),
    [categoryTree],
  );
  const incomeNodes = useMemo(
    () => sortNodesByActivity(categoryTree.filter((node) => node.type === "income")),
    [categoryTree],
  );

  const selectedNode = useMemo(() => {
    if (!selectedCategoryId) return null;
    return [...expenseNodes, ...incomeNodes].find((n) => n.id === selectedCategoryId) ?? null;
  }, [selectedCategoryId, expenseNodes, incomeNodes]);

  const selectedTransactions = useMemo(() => {
    if (!selectedCategoryId) return [];
    const ids = new Set([selectedCategoryId, ...getCategoryDescendantIds(snapshot.categories, selectedCategoryId)]);
    return monthTransactions.filter((tx) => tx.category_id && ids.has(tx.category_id));
  }, [selectedCategoryId, monthTransactions, snapshot.categories]);

  return (
    <div className="flex h-full flex-col overflow-hidden">

      {/* Chart + month nav — fixed height, never scrolls */}
      <div className="shrink-0 border-b border-border/40 px-4 pb-4 pt-5 sm:px-6 lg:px-7">
        <BudgetBarChart transactions={snapshot.transactions} currentMonth={month} />
        <div className="mt-3 flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => { setMonth((m) => addMonths(m, -1)); setSelectedCategoryId(null); }}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <button
            type="button"
            onClick={() => { setMonth(today); setSelectedCategoryId(null); }}
            className="type-body-14 rounded-md px-2 py-1 font-medium text-foreground transition-colors hover:bg-secondary/50"
          >
            {formatDate.dateTime(month, { month: "long", year: "numeric" })}
          </button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => { setMonth((m) => addMonths(m, 1)); setSelectedCategoryId(null); }}
          >
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      {/* Content area — fills rest of viewport */}
      <div className="flex min-h-0 flex-1">

        {/* Left: categories — always visible */}
        <div className={cn(
          "flex min-h-0 flex-col",
          selectedNode ? "hidden lg:flex lg:w-[340px] xl:w-[400px] lg:border-r lg:border-border/40" : "flex-1",
        )}>
          {/* Expenses — flex-[3]: takes most of the vertical space */}
          <div className="flex min-h-0 flex-[3] flex-col border-b border-border/40 px-4 sm:px-6 lg:px-7">
            <SectionHeader title={t("sections.expensesTitle")} nodes={expenseNodes} />
            <div className="flex-1 overflow-y-auto pb-3">
              {expenseNodes.length ? (
                <div className={cn(
                  "-mx-2 grid",
                  selectedNode ? "grid-cols-3 lg:grid-cols-4" : "grid-cols-4 sm:grid-cols-5 xl:grid-cols-6",
                )}>
                  {expenseNodes.map((node) => (
                    <CategoryTile
                      key={node.id}
                      node={node}
                      isSelected={selectedCategoryId === node.id}
                      onClick={() => setSelectedCategoryId(selectedCategoryId === node.id ? null : node.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="type-body-14 py-6 text-muted-foreground">{t("sections.expensesEmpty")}</p>
              )}
            </div>
          </div>

          {/* Income — flex-[2]: smaller, but still scrollable */}
          <div className="flex min-h-0 flex-[2] flex-col px-4 sm:px-6 lg:px-7">
            <SectionHeader title={t("sections.incomeTitle")} nodes={incomeNodes} />
            <div className="flex-1 overflow-y-auto pb-3">
              {incomeNodes.length ? (
                <div className={cn(
                  "-mx-2 grid",
                  selectedNode ? "grid-cols-3 lg:grid-cols-4" : "grid-cols-4 sm:grid-cols-5 xl:grid-cols-6",
                )}>
                  {incomeNodes.map((node) => (
                    <CategoryTile
                      key={node.id}
                      node={node}
                      isSelected={selectedCategoryId === node.id}
                      onClick={() => setSelectedCategoryId(selectedCategoryId === node.id ? null : node.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="type-body-14 py-6 text-muted-foreground">{t("sections.incomeEmpty")}</p>
              )}
            </div>
          </div>
        </div>

        {/* Right: category detail — scrollable, only when selected */}
        {selectedNode && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-y-auto px-4 py-5 sm:px-6 lg:px-7">
              <CategoryDetail
                node={selectedNode}
                transactions={selectedTransactions}
                emptyMessage={t("category.noTransactions")}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
