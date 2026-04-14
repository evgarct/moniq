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

// ─── Category row ─────────────────────────────────────────────────────────────

function CategoryRow({
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
        "flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition-colors focus:outline-none",
        "hover:bg-secondary/50",
        isSelected && "bg-secondary/60",
      )}
    >
      <CategoryIcon icon={node.icon} glyphClassName="size-[18px] shrink-0 text-muted-foreground" />
      <p className="type-body-14 min-w-0 flex-1 truncate font-medium text-foreground">{node.name}</p>
      {node.totals_by_currency.length ? (
        <div className="flex shrink-0 flex-col items-end">
          {node.totals_by_currency.map((total) => (
            <MoneyAmount
              key={total.currency}
              amount={total.amount}
              currency={total.currency}
              display="absolute"
              className="text-sm font-medium tabular-nums text-foreground"
            />
          ))}
        </div>
      ) : (
        <span className="shrink-0 text-sm text-muted-foreground">—</span>
      )}
    </button>
  );
}

// ─── Category list (inline section, no own Surface) ───────────────────────────

function CategoryList({
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
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <div className="mt-2 -mx-2 flex flex-col">
        {nodes.length ? (
          nodes.map((node) => (
            <CategoryRow
              key={node.id}
              node={node}
              isSelected={selectedCategoryId === node.id}
              onClick={() => onSelectCategory(selectedCategoryId === node.id ? null : node.id)}
            />
          ))
        ) : (
          <div className="type-body-14 mx-2 rounded-lg border border-dashed border-border px-4 py-8 text-muted-foreground">
            {emptyMessage}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Selected category detail (inline, no own Surface) ────────────────────────

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
      {/* Header row */}
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

      {/* Subcategory rows */}
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

      {/* Transactions */}
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

  function handleSelectCategory(id: string | null) {
    setSelectedCategoryId(id);
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* One shared Surface: chart + nav + all categories + detail */}
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

        <div className="my-5 border-t border-border/40" />

        <CategoryList
          title={t("sections.expensesTitle")}
          nodes={expenseNodes}
          emptyMessage={t("sections.expensesEmpty")}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleSelectCategory}
        />

        <div className="my-5 border-t border-border/40" />

        <CategoryList
          title={t("sections.incomeTitle")}
          nodes={incomeNodes}
          emptyMessage={t("sections.incomeEmpty")}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={handleSelectCategory}
        />

        {selectedNode && (
          <>
            <div className="my-5 border-t border-border/40" />
            <CategoryDetail
              node={selectedNode}
              transactions={selectedTransactions}
              emptyMessage={t("category.noTransactions")}
            />
          </>
        )}
      </Surface>
    </div>
  );
}
