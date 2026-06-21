"use client";

import { addMonths, isSameMonth, parseISO, startOfToday } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { PageHeader } from "@/components/page-header";
import { PageHeaderIconButton } from "@/components/page-header-icon-button";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { BudgetBarChart } from "@/features/budget/components/budget-bar-chart";
import { BudgetMonthAnalysisSheet } from "@/features/budget/components/budget-month-analysis-sheet";
import { getConvertedCategoryTotal } from "@/features/budget/lib/budget-analytics";
import { getCategoryDescendantIds, buildCategoryTree } from "@/features/categories/lib/category-tree";
import type { CategorySpendingReport } from "@/features/finance/lib/category-spending-report";
import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { TransactionsView } from "@/features/transactions/components/transactions-view";
import { calDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CategoryTreeNode, FinanceSnapshot, Transaction } from "@/types/finance";

function sortNodesByActivity(nodes: CategoryTreeNode[]) {
  return [...nodes].sort((left, right) => Math.abs(right.total_amount) - Math.abs(left.total_amount));
}

function CategoryRow({
  node,
  month,
  transactions,
  snapshot,
  selected,
  onSelect,
}: {
  node: CategoryTreeNode;
  month: Date;
  transactions: Transaction[];
  snapshot: FinanceSnapshot;
  selected: boolean;
  onSelect: () => void;
}) {
  const t = useTranslations("budget");
  const categoryIds = useMemo(
    () => new Set([node.id, ...getCategoryDescendantIds(snapshot.categories, node.id)]),
    [node.id, snapshot.categories],
  );
  const total = useMemo(
    () => getConvertedCategoryTotal({
      transactions,
      month,
      categoryIds,
      targetCurrency: snapshot.preferences.default_currency,
      exchangeRates: snapshot.exchange_rates,
    }),
    [categoryIds, month, snapshot.exchange_rates, snapshot.preferences.default_currency, transactions],
  );
  const linkedTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.category_id && categoryIds.has(transaction.category_id)),
    [categoryIds, transactions],
  );

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <button
        type="button"
        className={cn(
          "flex min-h-14 w-full items-center gap-3 rounded-[var(--radius-control)] px-2 py-2 text-left transition-[background-color] hover:bg-secondary/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          selected && "bg-secondary/60",
        )}
        onClick={onSelect}
        aria-expanded={selected}
      >
        <CategoryIcon icon={node.icon} glyphClassName="size-[18px] shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="type-body-14 block truncate font-medium text-foreground">{node.name}</span>
          <span className="type-body-12 block truncate text-muted-foreground">
            {t("category.childCount", { count: node.children.length })}
          </span>
        </span>
        {total.amount === null ? (
          <span className="type-body-12 shrink-0 text-muted-foreground">
            {t("category.rateUnavailable")}
          </span>
        ) : (
          <MoneyAmount
            amount={total.amount}
            currency={snapshot.preferences.default_currency}
            display="absolute"
            className="shrink-0 type-body-14 font-medium"
          />
        )}
        <ChevronDown className={cn("shrink-0 text-muted-foreground transition-transform", selected && "rotate-180")} />
      </button>

      {selected ? (
        <div className="flex flex-col gap-4 px-2 pb-5 pl-8">
          {node.children.length ? (
            <div className="flex flex-col">
              {sortNodesByActivity(node.children).map((child) => (
                <div key={child.id} className="flex min-h-11 items-center gap-3 border-b border-border/35 px-1 last:border-b-0">
                  <CategoryIcon icon={child.icon} glyphClassName="size-4 shrink-0 text-muted-foreground" />
                  <span className="type-body-14 min-w-0 flex-1 truncate">{child.name}</span>
                </div>
              ))}
            </div>
          ) : null}
          <TransactionList
            transactions={linkedTransactions}
            emptyMessage={t("category.noTransactions")}
            groupByDate
            showMinorUnits
          />
        </div>
      ) : null}
    </div>
  );
}

function CategorySection({
  title,
  nodes,
  month,
  transactions,
  snapshot,
  selectedCategoryId,
  onSelectCategory,
  emptyMessage,
}: {
  title: string;
  nodes: CategoryTreeNode[];
  month: Date;
  transactions: Transaction[];
  snapshot: FinanceSnapshot;
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  emptyMessage: string;
}) {
  return (
    <section className="border-t border-border/40 px-4 py-5 sm:px-6 lg:px-7">
      <h2 className="type-body-12 mb-2 font-semibold uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </h2>
      {nodes.length ? (
        <div className="flex flex-col">
          {nodes.map((node) => (
            <CategoryRow
              key={node.id}
              node={node}
              month={month}
              transactions={transactions}
              snapshot={snapshot}
              selected={selectedCategoryId === node.id}
              onSelect={() => onSelectCategory(selectedCategoryId === node.id ? null : node.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title={emptyMessage} description="" />
      )}
    </section>
  );
}

export function BudgetView({ snapshot }: { snapshot: FinanceSnapshot }) {
  const t = useTranslations("budget");
  const formatDate = useFormatter();
  const today = startOfToday();
  const [month, setMonth] = useState(today);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedMonthReport, setSelectedMonthReport] = useState<CategorySpendingReport | null>(null);
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false);

  const monthTransactions = useMemo(
    () => snapshot.transactions.filter(
      (transaction) =>
        isSettledTransactionStatus(transaction.status) &&
        isSameMonth(parseISO(transaction.occurred_at), month),
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

  function changeMonth(nextMonth: Date) {
    setMonth(nextMonth);
    setSelectedCategoryId(null);
  }

  return (
    <>
      <div className="mobile-nav-scroll-clearance h-full overflow-y-auto bg-background [scroll-padding-bottom:calc(76px+env(safe-area-inset-bottom))]">
        <PageHeader
          title={t("view.title")}
          actions={
            <PageHeaderIconButton
              icon={Settings2}
              label={t("view.manageCategories")}
              onClick={() => setCategoryManagerOpen(true)}
            />
          }
        />

        <section className="px-4 pb-4 sm:px-6 lg:px-7">
          <BudgetBarChart
            transactions={snapshot.transactions}
            categories={snapshot.categories}
            currentMonth={month}
            targetCurrency={snapshot.preferences.default_currency}
            exchangeRates={snapshot.exchange_rates}
            onMonthSelect={setSelectedMonthReport}
          />
          <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
            <PageHeaderIconButton
              icon={ChevronLeft}
              label={t("monthChart.previousMonth")}
              onClick={() => changeMonth(addMonths(month, -1))}
            />
            <Button
              variant="ghost"
              onClick={() => changeMonth(today)}
              className="min-w-0 justify-center bg-transparent"
            >
              <span className="truncate">
                {formatDate.dateTime(calDate(month), { month: "long", year: "numeric" })}
              </span>
            </Button>
            <PageHeaderIconButton
              icon={ChevronRight}
              label={t("monthChart.nextMonth")}
              onClick={() => changeMonth(addMonths(month, 1))}
            />
          </div>
        </section>

        <CategorySection
          title={t("sections.expensesTitle")}
          nodes={expenseNodes}
          month={month}
          transactions={monthTransactions}
          snapshot={snapshot}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          emptyMessage={t("sections.expensesEmpty")}
        />
        <CategorySection
          title={t("sections.incomeTitle")}
          nodes={incomeNodes}
          month={month}
          transactions={monthTransactions}
          snapshot={snapshot}
          selectedCategoryId={selectedCategoryId}
          onSelectCategory={setSelectedCategoryId}
          emptyMessage={t("sections.incomeEmpty")}
        />
      </div>

      <Sheet open={categoryManagerOpen} onOpenChange={setCategoryManagerOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-none gap-0 overflow-hidden p-0 pt-[var(--safe-area-inset-top)] lg:max-w-[min(1100px,85vw)] lg:pt-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>{t("view.manageCategories")}</SheetTitle>
            <SheetDescription>{t("view.manageCategoriesDescription")}</SheetDescription>
          </SheetHeader>
          <div className="h-full overflow-y-auto p-4 sm:p-6">
            <TransactionsView snapshot={snapshot} basePath="/budget" />
          </div>
        </SheetContent>
      </Sheet>

      <BudgetMonthAnalysisSheet
        report={selectedMonthReport}
        open={Boolean(selectedMonthReport)}
        onOpenChange={(open) => {
          if (!open) setSelectedMonthReport(null);
        }}
      />
    </>
  );
}
