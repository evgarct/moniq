"use client";

import { addMonths, isSameMonth, parseISO, startOfToday } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, Settings2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { PageHeader } from "@/components/page-header";
import { PageHeaderIconButton } from "@/components/page-header-icon-button";
import { Surface } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { BudgetBarChart } from "@/features/budget/components/budget-bar-chart";
import { BudgetMonthAnalysisSheet } from "@/features/budget/components/budget-month-analysis-sheet";
import { BudgetSummary } from "@/features/budget/components/budget-summary";
import {
  buildCategoryPath,
  EnvelopeDetail,
  InlineEditor,
  type CategoryEditorState,
} from "@/features/budget/components/envelope-detail";
import { EnvelopeRow } from "@/features/budget/components/envelope-row";
import { buildEnvelopeBudgetRows, summarizeEnvelopeBudget, sumEnvelopeSpend, type EnvelopeBudgetRow } from "@/features/budget/lib/envelope-budget";
import { CategoryDeleteSheet } from "@/features/categories/components/category-delete-sheet";
import { buildCategoryTree, getManageableCategories } from "@/features/categories/lib/category-tree";
import { useFinanceActions } from "@/features/finance/hooks/use-finance-actions";
import type { CategorySpendingReport } from "@/features/finance/lib/category-spending-report";
import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { calDate } from "@/lib/formatters";
import type { Category, CategoryType, FinanceSnapshot } from "@/types/finance";
import type { CategoryInput } from "@/types/finance-schemas";

const DESKTOP_QUERY = "(min-width: 1024px)";

function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches);

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const update = () => setIsDesktop(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return isDesktop;
}

function EnvelopeGroup({
  title,
  type,
  rows,
  currency,
  selectedCategoryId,
  editMode,
  editor,
  manageableCategories,
  emptyMessage,
  onSelect,
  onEditState,
  onSave,
  onDelete,
}: {
  title: string;
  type: CategoryType;
  rows: EnvelopeBudgetRow[];
  currency: FinanceSnapshot["preferences"]["default_currency"];
  selectedCategoryId: string | null;
  editMode: boolean;
  editor: CategoryEditorState | null;
  manageableCategories: Category[];
  emptyMessage: string;
  onSelect: (id: string) => void;
  onEditState: (editor: CategoryEditorState | null) => void;
  onSave: (editor: CategoryEditorState, values: CategoryInput) => void;
  onDelete: (category: Category) => void;
}) {
  const commonT = useTranslations("common.actions");
  const addingRoot = editor?.mode === "add" && editor.type === type && editor.parentId === null;

  return (
    <div className="flex flex-col">
      <div className="mb-1 flex items-center justify-between gap-3 px-1">
        <h2 className="type-body-12 font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
        {editMode ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onEditState({ mode: "add", type, parentId: null })}>
            <Plus className="mr-1 size-4" />
            {commonT("add")}
          </Button>
        ) : null}
      </div>
      {addingRoot ? (
        <div className="mb-3">
          <InlineEditor editor={editor} categories={manageableCategories} onSave={(values) => onSave(editor, values)} onCancel={() => onEditState(null)} />
        </div>
      ) : null}
      {rows.length ? (
        <div className="flex flex-col">
          {rows.map((row) => (
            <EnvelopeRow
              key={row.id}
              row={row}
              currency={currency}
              kind={type}
              selected={selectedCategoryId === row.id}
              editMode={editMode}
              onSelect={() => onSelect(row.id)}
              onDelete={row.node.purpose ? undefined : () => onDelete(row.node)}
            />
          ))}
        </div>
      ) : !addingRoot ? (
        <EmptyState illustration={null} title={emptyMessage} description="" className="py-6" />
      ) : null}
    </div>
  );
}

export function BudgetView({
  snapshot,
  onDisplayedMonthChange,
}: {
  snapshot: FinanceSnapshot;
  onDisplayedMonthChange?: (month: Date) => void;
}) {
  const t = useTranslations("budget");
  const categoriesT = useTranslations("categories.view");
  const formatDate = useFormatter();
  const financeActions = useFinanceActions();
  const isDesktop = useIsDesktop();
  const today = startOfToday();
  const [month, setMonth] = useState(today);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedMonthReport, setSelectedMonthReport] = useState<CategorySpendingReport | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editor, setEditor] = useState<CategoryEditorState | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const currency = snapshot.preferences.default_currency;

  const manageableCategories = useMemo(() => getManageableCategories(snapshot.categories), [snapshot.categories]);
  const monthTransactions = useMemo(
    () => snapshot.transactions.filter((transaction) => isSettledTransactionStatus(transaction.status) && isSameMonth(parseISO(transaction.occurred_at), month)),
    [month, snapshot.transactions],
  );
  const categoryTree = useMemo(() => buildCategoryTree(manageableCategories, monthTransactions), [manageableCategories, monthTransactions]);
  const rowOptions = useMemo(
    () => ({ categories: snapshot.categories, transactions: monthTransactions, month, targetCurrency: currency, exchangeRates: snapshot.exchange_rates }),
    [snapshot.categories, snapshot.exchange_rates, monthTransactions, month, currency],
  );
  const expenseRows = useMemo(
    () => buildEnvelopeBudgetRows({ ...rowOptions, nodes: categoryTree.filter((node) => node.type === "expense") }),
    [categoryTree, rowOptions],
  );
  const incomeRows = useMemo(
    () => buildEnvelopeBudgetRows({ ...rowOptions, nodes: categoryTree.filter((node) => node.type === "income") }),
    [categoryTree, rowOptions],
  );
  const summary = useMemo(() => summarizeEnvelopeBudget(expenseRows), [expenseRows]);
  const incomeTotal = useMemo(() => sumEnvelopeSpend(incomeRows), [incomeRows]);

  const selectedPath = useMemo(
    () => (selectedCategoryId ? buildCategoryPath(selectedCategoryId, manageableCategories) : []),
    [selectedCategoryId, manageableCategories],
  );
  const mobileDetailOpen = !isDesktop && Boolean(selectedCategoryId);
  const backLabel = selectedPath.length > 1 ? selectedPath[selectedPath.length - 2].name : t("view.title");

  const replacementOptions = deletingCategory
    ? manageableCategories.filter((category) => category.type === deletingCategory.type && category.id !== deletingCategory.id)
    : [];
  const deletingTransactionCount = deletingCategory
    ? snapshot.transactions.filter((transaction) => transaction.category_id === deletingCategory.id).length
    : 0;

  function changeMonth(nextMonth: Date) {
    setMonth(nextMonth);
    onDisplayedMonthChange?.(nextMonth);
    setSelectedCategoryId(null);
  }

  function toggleCategory(id: string) {
    setSelectedCategoryId((current) => (isDesktop && current === id ? null : id));
  }

  function goBack() {
    setSelectedCategoryId(selectedPath.length > 1 ? selectedPath[selectedPath.length - 2].id : null);
  }

  function saveCategory(activeEditor: CategoryEditorState, values: CategoryInput) {
    financeActions.saveCategory(
      activeEditor.mode,
      values,
      activeEditor.mode === "edit" ? activeEditor.category.id : undefined,
      { onError: (error) => setActionError(error instanceof Error ? error.message : categoriesT("saveError")) },
    );
    setEditor(null);
    setActionError(null);
  }

  const detailProps = {
    month,
    transactions: monthTransactions,
    snapshot,
    editMode,
    editor,
    manageableCategories,
    backLabel,
    onBack: goBack,
    onSelectCategory: setSelectedCategoryId,
    onEditState: setEditor,
    onSave: saveCategory,
    onDelete: setDeletingCategory,
  };
  const groupProps = {
    currency,
    selectedCategoryId,
    editMode,
    editor,
    manageableCategories,
    onSelect: toggleCategory,
    onEditState: setEditor,
    onSave: saveCategory,
    onDelete: setDeletingCategory,
  };

  return (
    <>
      <div className="mobile-nav-scroll-clearance h-full overflow-y-auto bg-card lg:bg-background [scroll-padding-bottom:calc(76px+env(safe-area-inset-bottom))] lg:[scroll-padding-bottom:1rem]">
        <PageHeader
          title={t("view.title")}
          actions={
            <PageHeaderIconButton
              icon={Settings2}
              label={editMode ? t("view.finishManagingCategories") : t("view.manageCategories")}
              pressed={editMode}
              onClick={() => {
                setEditMode((current) => !current);
                setEditor(null);
                setSelectedCategoryId(null);
              }}
            />
          }
        />

        {actionError ? <p className="mx-4 mb-3 rounded-[var(--radius-control)] bg-destructive/10 px-3 py-2 type-body-14 text-destructive sm:mx-6 lg:mx-7">{actionError}</p> : null}

        <section className="px-4 pb-3 sm:px-6 lg:px-7">
          <BudgetBarChart
            compact
            transactions={snapshot.transactions}
            categories={manageableCategories}
            currentMonth={month}
            targetCurrency={currency}
            exchangeRates={snapshot.exchange_rates}
            onMonthSelect={setSelectedMonthReport}
          />
          <div className="mt-2 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
            <PageHeaderIconButton icon={ChevronLeft} label={t("monthChart.previousMonth")} onClick={() => changeMonth(addMonths(month, -1))} />
            <Button variant="ghost" onClick={() => changeMonth(today)} className="min-w-0 justify-center bg-transparent">
              <span className="truncate">{formatDate.dateTime(calDate(month), { month: "long", year: "numeric" })}</span>
            </Button>
            <PageHeaderIconButton icon={ChevronRight} label={t("monthChart.nextMonth")} onClick={() => changeMonth(addMonths(month, 1))} />
          </div>
        </section>

        <BudgetSummary summary={summary} income={incomeTotal} currency={currency} />

        <div className="grid grid-cols-1 gap-6 px-4 pb-8 sm:px-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:px-7">
          <div className="flex flex-col gap-6">
            <EnvelopeGroup title={t("sections.expensesTitle")} type="expense" rows={expenseRows} emptyMessage={t("sections.expensesEmpty")} {...groupProps} />
            <EnvelopeGroup title={t("sections.incomeTitle")} type="income" rows={incomeRows} emptyMessage={t("sections.incomeEmpty")} {...groupProps} />
          </div>

          {isDesktop ? (
            <div className="flex flex-col">
              {selectedCategoryId ? (
                <EnvelopeDetail key={selectedCategoryId} nodeId={selectedCategoryId} variant="panel" {...detailProps} />
              ) : (
                <Surface tone="panel" padding="lg" className="h-full min-h-[300px]">
                  <EmptyState illustration="budget" title={t("category.selectPrompt")} description={t("category.selectPromptDesc")} />
                </Surface>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <Sheet
        open={mobileDetailOpen}
        onOpenChange={(open) => {
          if (!open) setSelectedCategoryId(null);
        }}
      >
        <SheetContent side="fullscreen" className="gap-0 p-0 lg:hidden" showCloseButton={false}>
          <SheetTitle className="sr-only">{selectedPath[selectedPath.length - 1]?.name ?? t("view.title")}</SheetTitle>
          <div className="min-h-0 flex-1 overflow-auto">
            {selectedCategoryId ? <EnvelopeDetail key={selectedCategoryId} nodeId={selectedCategoryId} variant="screen" {...detailProps} /> : null}
          </div>
        </SheetContent>
      </Sheet>

      <CategoryDeleteSheet
        key={deletingCategory?.id ?? "budget-category-delete"}
        open={Boolean(deletingCategory)}
        category={deletingCategory}
        replacementOptions={replacementOptions}
        transactionCount={deletingTransactionCount}
        onOpenChange={(open) => { if (!open) setDeletingCategory(null); }}
        onSubmit={(replacementCategoryId) => {
          if (!deletingCategory) return;
          financeActions.deleteCategory(deletingCategory.id, replacementCategoryId, {
            onError: (error) => setActionError(error instanceof Error ? error.message : categoriesT("deleteError")),
          });
          setDeletingCategory(null);
          setActionError(null);
        }}
      />

      <BudgetMonthAnalysisSheet
        report={selectedMonthReport}
        open={Boolean(selectedMonthReport)}
        onOpenChange={(open) => { if (!open) setSelectedMonthReport(null); }}
      />
    </>
  );
}
