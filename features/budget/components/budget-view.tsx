"use client";

import { addMonths, isSameMonth, parseISO, startOfToday } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { BudgetBarChart } from "@/features/budget/components/budget-bar-chart";
import { CategoryIcon } from "@/components/category-icon";
import { MoneyAmount } from "@/components/money-amount";
import { Surface } from "@/components/surface";
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
        "flex flex-col items-center gap-2 rounded-lg px-2 py-3 text-center transition-colors focus:outline-none",
        "hover:bg-secondary/60",
        isSelected ? "bg-secondary/80" : "",
      )}
    >
      <CategoryIcon icon={node.icon} glyphClassName="size-[18px] text-muted-foreground" />
      <div className="w-full min-w-0">
        <p className="truncate text-[13px] font-medium leading-tight text-foreground">{node.name}</p>
        {node.totals_by_currency.length ? (
          <div className="mt-0.5 flex flex-col items-center">
            {node.totals_by_currency.map((total) => (
              <MoneyAmount
                key={total.currency}
                amount={total.amount}
                currency={total.currency}
                display="absolute"
                className="text-xs text-muted-foreground tabular-nums"
              />
            ))}
          </div>
        ) : (
          <span className="mt-0.5 text-xs text-muted-foreground">—</span>
        )}
      </div>
    </button>
  );
}

// ─── Category section ─────────────────────────────────────────────────────────

function CategorySection({
  title,
  nodes,
  emptyMessage,
  selectedCategoryId,
  onSelectCategory,
}: {
  title: string;
  nodes: CategoryTreeNode[];
  emptyMessage: string;
  selectedCategoryId: string | null;
  onSelectCategory: (id: string | null) => void;
}) {
  return (
    <Surface tone="panel" padding="lg" className="border border-black/5">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>

      <div className="mt-4">
        {nodes.length ? (
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
            {nodes.map((node) => (
              <CategoryTile
                key={node.id}
                node={node}
                isSelected={selectedCategoryId === node.id}
                onClick={() => onSelectCategory(selectedCategoryId === node.id ? null : node.id)}
              />
            ))}
          </div>
        ) : (
          <div className="type-body-14 rounded-lg border border-dashed border-border px-4 py-8 text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </div>
    </Surface>
  );
}

// ─── Inline transaction panel ─────────────────────────────────────────────────

function CategoryTransactionPanel({
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
    <Surface tone="panel" padding="lg" className="border border-black/5">
      {/* Header */}
      <div className="mb-4 flex items-center gap-3">
        <CategoryIcon icon={node.icon} glyphClassName="size-[18px] text-muted-foreground" />
        <div className="flex min-w-0 flex-1 items-center justify-between gap-4">
          <p className="text-sm font-medium text-foreground">{node.name}</p>
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

      {/* Subcategories */}
      {sortedChildren.length > 0 && (
        <div className="mb-5 flex flex-col">
          {sortedChildren.map((child, i) => (
            <div
              key={child.id}
              className={cn(
                "flex items-center gap-3 py-2",
                i > 0 && "border-t border-border/40",
              )}
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

      {/* Transactions */}
      <TransactionList
        transactions={transactions}
        emptyMessage={emptyMessage}
        groupByDate
        showMinorUnits
      />
    </Surface>
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

  // Resolve selected node across both trees
  const selectedNode = useMemo(() => {
    if (!selectedCategoryId) return null;
    return [...expenseNodes, ...incomeNodes].find((n) => n.id === selectedCategoryId) ?? null;
  }, [selectedCategoryId, expenseNodes, incomeNodes]);

  // Transactions for selected category (including descendants)
  const selectedTransactions = useMemo(() => {
    if (!selectedCategoryId) return [];
    const ids = new Set([selectedCategoryId, ...getCategoryDescendantIds(snapshot.categories, selectedCategoryId)]);
    return monthTransactions.filter((tx) => tx.category_id && ids.has(tx.category_id));
  }, [selectedCategoryId, monthTransactions, snapshot.categories]);

  function handleSelectCategory(id: string | null) {
    setSelectedCategoryId(id);
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-y-auto">
      {/* Bar chart + month navigation */}
      <Surface tone="panel" padding="lg" className="border border-black/5">
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
            className="rounded-full px-3 py-1 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
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
      </Surface>

      {/* Category grids */}
      <div className="grid gap-4 xl:grid-cols-2">
        <CategorySection
          title={t("sections.expensesTitle")}
          nodes={expenseNodes}
          emptyMessage={t("sections.expensesEmpty")}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleSelectCategory}
        />
        <CategorySection
          title={t("sections.incomeTitle")}
          nodes={incomeNodes}
          emptyMessage={t("sections.incomeEmpty")}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleSelectCategory}
        />
      </div>

      {/* Inline transaction panel */}
      {selectedNode ? (
        <CategoryTransactionPanel
          node={selectedNode}
          transactions={selectedTransactions}
          emptyMessage={t("category.noTransactions")}
        />
      ) : null}
    </div>
  );
}
