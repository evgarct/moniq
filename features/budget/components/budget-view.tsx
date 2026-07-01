"use client";

import { addMonths, isSameMonth, parseISO, startOfToday } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, PencilLine, Plus, Settings2, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { CategoryIcon } from "@/components/category-icon";
import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { PageHeader } from "@/components/page-header";
import { PageHeaderIconButton } from "@/components/page-header-icon-button";
import { TransactionList } from "@/components/transaction-list";
import { Surface } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BudgetBarChart } from "@/features/budget/components/budget-bar-chart";
import { BudgetInlineCategoryEditor } from "@/features/budget/components/budget-inline-category-editor";
import { BudgetMonthAnalysisSheet } from "@/features/budget/components/budget-month-analysis-sheet";
import { getConvertedCategoryTotal, parseCategoryDescriptionAndBudget, serializeCategoryDescriptionAndBudget } from "@/features/budget/lib/budget-analytics";
import { CategoryDeleteSheet } from "@/features/categories/components/category-delete-sheet";
import {
  buildCategoryTree,
  getCategoryDescendantIds,
  getManageableCategories,
} from "@/features/categories/lib/category-tree";
import { useFinanceActions } from "@/features/finance/hooks/use-finance-actions";
import type { CategorySpendingReport } from "@/features/finance/lib/category-spending-report";
import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { calDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Category, CategoryTreeNode, CategoryType, FinanceSnapshot, Transaction } from "@/types/finance";
import type { CategoryInput } from "@/types/finance-schemas";

type CategoryEditorState =
  | { mode: "add"; type: CategoryType; parentId: string | null }
  | { mode: "edit"; category: Category };

function sortNodesByActivity(nodes: CategoryTreeNode[]) {
  return [...nodes].sort((left, right) => Math.abs(right.total_amount) - Math.abs(left.total_amount));
}

function findCategoryTreeNode(nodes: CategoryTreeNode[], id: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findCategoryTreeNode(node.children, id);
    if (found) return found;
  }
  return null;
}

function buildCategoryPath(nodeId: string, categories: Category[]): Category[] {
  const path: Category[] = [];
  let current = categories.find((c) => c.id === nodeId);
  while (current) {
    path.unshift(current);
    const parentId = current.parent_id;
    current = parentId ? categories.find((c) => c.id === parentId) : undefined;
  }
  return path;
}

function InlineEditor({
  editor,
  categories,
  onSave,
  onCancel,
}: {
  editor: CategoryEditorState;
  categories: Category[];
  onSave: (values: CategoryInput) => void;
  onCancel: () => void;
}) {
  const category = editor.mode === "edit" ? editor.category : null;
  const initialType = editor.mode === "edit" ? editor.category.type : editor.type;
  const initialParentId = editor.mode === "edit" ? editor.category.parent_id : editor.parentId;
  return (
    <BudgetInlineCategoryEditor
      key={editor.mode === "edit" ? editor.category.id : `new-${editor.type}-${editor.parentId ?? "root"}`}
      category={category}
      categories={categories}
      initialType={initialType}
      initialParentId={initialParentId}
      onSubmit={onSave}
      onCancel={onCancel}
    />
  );
}

function CategoryCircleItem({
  node,
  month,
  transactions,
  snapshot,
  selected,
  editMode,
  onClick,
  onDelete,
}: {
  node: CategoryTreeNode;
  month: Date;
  transactions: Transaction[];
  snapshot: FinanceSnapshot;
  selected: boolean;
  editMode: boolean;
  onClick: () => void;
  onDelete: (category: Category) => void;
}) {
  const defaultCurrency = snapshot.preferences.default_currency;
  
  const categoryIds = useMemo(
    () => new Set([node.id, ...getCategoryDescendantIds(snapshot.categories, node.id)]),
    [node.id, snapshot.categories],
  );
  
  const total = useMemo(
    () => getConvertedCategoryTotal({
      transactions,
      month,
      categoryIds,
      targetCurrency: defaultCurrency,
      exchangeRates: snapshot.exchange_rates,
    }),
    [categoryIds, month, snapshot.exchange_rates, defaultCurrency, transactions],
  );
  
  const parsed = useMemo(() => parseCategoryDescriptionAndBudget(node.description), [node.description]);

  const budgetUtilization = useMemo(() => {
    if (parsed.plannedBudget === null || parsed.plannedBudget <= 0) return 0;
    return Math.min(100, Math.max(0, (Math.abs(total.amount || 0) / parsed.plannedBudget) * 100));
  }, [total.amount, parsed.plannedBudget]);

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (budgetUtilization / 100) * circumference;

  return (
    <button
      type="button"
      className="group flex w-20 flex-col items-center text-center gap-1.5 relative select-none active:scale-[0.96] transition-transform duration-150"
      onClick={onClick}
    >
      {/* Edit mode delete badge */}
      {editMode && !node.purpose && (
        <span
          role="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete(node);
          }}
          className="absolute -top-1 -right-1 z-10 flex size-5 items-center justify-center rounded-full bg-destructive text-white hover:bg-destructive/90 shadow-sm active:scale-95 transition-transform"
        >
          <X className="size-3" />
        </span>
      )}

      {/* Circle Icon and Progress SVG */}
      <div 
        className={cn(
          "relative size-14 flex items-center justify-center rounded-full border transition-[background-color,border-color] duration-150",
          selected
            ? "bg-secondary/70 border-foreground text-foreground"
            : "bg-secondary/20 border-border/40 text-muted-foreground group-hover:bg-secondary/40 group-hover:text-foreground"
        )}
      >
        {parsed.plannedBudget !== null && (
          <svg className="absolute -top-[5px] -left-[5px] size-16 -rotate-90">
            <circle
              cx="32"
              cy="32"
              r={radius}
              className="stroke-secondary/35"
              strokeWidth="2"
              fill="transparent"
            />
            <circle
              cx="32"
              cy="32"
              r={radius}
              className={cn(
                "transition-all duration-300",
                budgetUtilization >= 100 ? "stroke-destructive" : "stroke-neutral-800 dark:stroke-neutral-200"
              )}
              strokeWidth="2"
              fill="transparent"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
            />
          </svg>
        )}
        <CategoryIcon icon={node.icon} glyphClassName={cn("size-5 text-muted-foreground transition-colors", selected && "text-foreground")} />
      </div>

      {/* Text labels */}
      <div className="min-w-0 w-full">
        <p className={cn("text-xs truncate font-medium text-foreground leading-tight", selected && "font-semibold")}>
          {node.name}
        </p>
        <p className="text-[11px] truncate text-muted-foreground mt-0.5 font-medium tabular-nums">
          {total.amount !== null ? (
            <MoneyAmount amount={total.amount} currency={defaultCurrency} display="absolute" className="inline text-muted-foreground" />
          ) : (
            "—"
          )}
        </p>
      </div>
    </button>
  );
}

function InlineBudgetInput({
  category,
  onSave,
  currency,
}: {
  category: Category;
  onSave: (values: CategoryInput) => void;
  currency: string;
}) {
  const parsed = useMemo(() => parseCategoryDescriptionAndBudget(category.description), [category.description]);
  const [value, setValue] = useState(parsed.plannedBudget !== null ? String(parsed.plannedBudget) : "");

  useMemo(() => {
    setValue(parsed.plannedBudget !== null ? String(parsed.plannedBudget) : "");
  }, [parsed.plannedBudget]);

  const handleBlurOrSubmit = () => {
    const trimmed = value.trim();
    const budgetVal = trimmed === "" ? null : parseFloat(trimmed);
    const oldBudget = parsed.plannedBudget;
    if (budgetVal === oldBudget) return;

    onSave({
      name: category.name,
      description: serializeCategoryDescriptionAndBudget(parsed.description, budgetVal) || null,
      icon: category.icon,
      type: category.type,
      parent_id: category.parent_id,
    });
  };

  return (
    <div className="flex items-center gap-1.5 mt-1 relative">
      <Input
        type="number"
        step="any"
        min="0"
        placeholder="—"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={handleBlurOrSubmit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
        className="h-8 w-24 border-border/40 bg-background/50 px-2 text-sm font-semibold tabular-nums focus:bg-background focus:ring-1 focus:ring-ring/25 active:scale-[0.98]"
      />
      <span className="text-sm font-medium text-muted-foreground">{currency}</span>
    </div>
  );
}

function CategoryDetailsPanel({
  nodeId,
  month,
  transactions,
  snapshot,
  editMode,
  editor,
  manageableCategories,
  onSelectCategory,
  onEditState,
  onSave,
  onDelete,
}: {
  nodeId: string;
  month: Date;
  transactions: Transaction[];
  snapshot: FinanceSnapshot;
  editMode: boolean;
  editor: CategoryEditorState | null;
  manageableCategories: Category[];
  onSelectCategory: (id: string | null) => void;
  onEditState: (state: CategoryEditorState | null) => void;
  onSave: (editor: CategoryEditorState, values: CategoryInput) => void;
  onDelete: (category: Category) => void;
}) {
  const t = useTranslations("budget");
  const categoriesTreeT = useTranslations("categories.tree");
  const defaultCurrency = snapshot.preferences.default_currency;
  const [showTransactions, setShowTransactions] = useState(false);

  const node = useMemo(() => {
    const tree = buildCategoryTree(manageableCategories, transactions);
    return findCategoryTreeNode(tree, nodeId);
  }, [manageableCategories, transactions, nodeId]);

  const categoryIds = useMemo(
    () => new Set(node ? [node.id, ...getCategoryDescendantIds(snapshot.categories, node.id)] : []),
    [node, snapshot.categories],
  );

  const total = useMemo(() => getConvertedCategoryTotal({
    transactions,
    month,
    categoryIds,
    targetCurrency: defaultCurrency,
    exchangeRates: snapshot.exchange_rates,
  }), [transactions, month, categoryIds, defaultCurrency, snapshot.exchange_rates]);

  const linkedTransactions = useMemo(() => transactions.filter(
    (transaction) => transaction.category_id && categoryIds.has(transaction.category_id),
  ), [transactions, categoryIds]);

  const parsed = useMemo(() => parseCategoryDescriptionAndBudget(node?.description), [node]);
  const path = useMemo(() => node ? buildCategoryPath(node.id, manageableCategories) : [], [node, manageableCategories]);

  if (!node) return null;

  const editingHere = editor?.mode === "edit" && editor.category.id === node.id;
  const addingHere = editor?.mode === "add" && editor.parentId === node.id;

  if (editMode && (editingHere || addingHere)) {
    return (
      <div className="mt-4">
        <InlineEditor
          editor={editor!}
          categories={manageableCategories}
          onSave={(values) => onSave(editor!, values)}
          onCancel={() => onEditState(null)}
        />
      </div>
    );
  }

  const handleBack = () => {
    if (path.length > 1) {
      onSelectCategory(path[path.length - 2].id);
    } else {
      onSelectCategory(null);
    }
  };

  return (
    <Surface tone="panel" padding="md" className="flex flex-col gap-4">
      {/* Header back button navigation */}
      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleBack}
          className="h-9 px-2 text-muted-foreground hover:text-foreground active:scale-[0.98] transition-transform"
        >
          <ChevronLeft className="size-4 mr-1 shrink-0" />
          <span>{path.length > 1 ? path[path.length - 2].name : t("view.title")}</span>
        </Button>

        {editMode ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEditState({ mode: "add", type: node.type, parentId: node.id })}
            >
              <Plus className="size-4 mr-1.5" />
              {categoriesTreeT("addChild")}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onEditState({ mode: "edit", category: node })}
            >
              <PencilLine className="size-4 mr-1.5" />
              {categoriesTreeT("editCategory")}
            </Button>
            {node.purpose ? null : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDelete(node)}
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="size-4 mr-1.5" />
                {categoriesTreeT("deleteCategory")}
              </Button>
            )}
          </div>
        ) : null}
      </div>

      {/* Category Info */}
      <div className="flex items-center gap-3 mt-1">
        <CategoryIcon icon={node.icon} glyphClassName="size-6 text-muted-foreground" />
        <div>
          <h3 className="type-h4 font-serif">{node.name}</h3>
          {parsed.description ? (
            <p className="type-body-14 text-muted-foreground mt-1 max-w-xl">{parsed.description}</p>
          ) : null}
        </div>
      </div>

      {/* Actual Spent vs Planned */}
      <div className="grid grid-cols-2 gap-4 border-y border-border/20 py-4 my-2">
        <div>
          <span className="type-body-12 text-muted-foreground uppercase tracking-wider block">
            {t("category.actual")}
          </span>
          <span className="type-h3 font-semibold tabular-nums mt-1 block">
            {total.amount !== null ? (
              <MoneyAmount amount={total.amount} currency={defaultCurrency} display="absolute" />
            ) : (
              "—"
            )}
          </span>
        </div>
        <div>
          <span className="type-body-12 text-muted-foreground uppercase tracking-wider block font-medium">
            {t("category.planned")}
          </span>
          {editMode ? (
            <span className="type-h3 font-semibold tabular-nums mt-1 block">
              {parsed.plannedBudget !== null ? (
                <MoneyAmount amount={parsed.plannedBudget} currency={defaultCurrency} display="absolute" />
              ) : (
                "—"
              )}
            </span>
          ) : (
            <InlineBudgetInput category={node} onSave={(values) => onSave(editor || { mode: "edit", category: node }, values)} currency={defaultCurrency} />
          )}
        </div>
      </div>

      {/* Subcategories nested stack */}
      {node.children.length ? (
        <div className="flex flex-col gap-3 mt-2">
          <span className="type-body-12 text-muted-foreground uppercase tracking-wider">
            {t("category.childCount", { count: node.children.length })}
          </span>
          <div className="flex flex-wrap gap-x-6 gap-y-5 justify-start px-1 py-1">
            {sortNodesByActivity(node.children).map((child) => (
              <CategoryCircleItem
                key={child.id}
                node={child}
                month={month}
                transactions={transactions}
                snapshot={snapshot}
                selected={false}
                editMode={editMode}
                onClick={() => onSelectCategory(child.id)}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      ) : null}

      {/* Transactions collapsible list */}
      <div className="border-t border-border/40 pt-4 flex flex-col gap-3">
        <div>
          {!showTransactions ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setShowTransactions(true)} className="active:scale-[0.98] transition-transform">
              <ChevronDown className="size-4 mr-1.5" />
              {t("category.showTransactions", { count: String(linkedTransactions.length) })}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => setShowTransactions(false)} className="mb-2 active:scale-[0.98] transition-transform">
                <ChevronUp className="size-4 mr-1.5" />
                {t("category.hideTransactions")}
              </Button>
              <div className="mt-2 rounded-[var(--radius-control)] border border-border/35 bg-background/50 p-2">
                <TransactionList
                  transactions={linkedTransactions}
                  emptyMessage={t("category.noTransactions")}
                  groupByDate
                  showMinorUnits
                  targetCurrency={defaultCurrency}
                  exchangeRates={snapshot.exchange_rates}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </Surface>
  );
}

function CategorySection({
  title,
  type,
  nodes,
  month,
  transactions,
  snapshot,
  editMode,
  editor,
  manageableCategories,
  selectedCategoryId,
  onSelectCategory,
  onEditState,
  onSave,
  onDelete,
  emptyMessage,
}: {
  title: string;
  type: CategoryType;
  nodes: CategoryTreeNode[];
  month: Date;
  transactions: Transaction[];
  snapshot: FinanceSnapshot;
  editMode: boolean;
  editor: CategoryEditorState | null;
  manageableCategories: Category[];
  selectedCategoryId: string | null;
  onSelectCategory: (categoryId: string | null) => void;
  onEditState: (editor: CategoryEditorState | null) => void;
  onSave: (editor: CategoryEditorState, values: CategoryInput) => void;
  onDelete: (category: Category) => void;
  emptyMessage: string;
}) {
  const commonT = useTranslations("common.actions");
  const addingRoot = editor?.mode === "add" && editor.type === type && editor.parentId === null;

  return (
    <div className="flex flex-col">
      <div className="mb-2 flex items-center justify-between gap-3 px-1">
        <h2 className="type-body-12 font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
        {editMode ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onEditState({ mode: "add", type, parentId: null })}>
            <Plus className="size-4 mr-1" />{commonT("add")}
          </Button>
        ) : null}
      </div>
      {addingRoot ? (
        <div className="mb-3">
          <InlineEditor editor={editor} categories={manageableCategories} onSave={(values) => onSave(editor, values)} onCancel={() => onEditState(null)} />
        </div>
      ) : null}
      {nodes.length ? (
        <div className="flex flex-wrap gap-x-6 gap-y-5 justify-start px-2 py-1">
          {nodes.map((node) => (
            <CategoryCircleItem
              key={node.id}
              node={node}
              month={month}
              transactions={transactions}
              snapshot={snapshot}
              selected={selectedCategoryId === node.id}
              editMode={editMode}
              onClick={() => onSelectCategory(selectedCategoryId === node.id ? null : node.id)}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : !addingRoot ? (
        <EmptyState title={emptyMessage} description="" className="py-6" />
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
  const today = startOfToday();
  const [month, setMonth] = useState(today);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [selectedMonthReport, setSelectedMonthReport] = useState<CategorySpendingReport | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [editor, setEditor] = useState<CategoryEditorState | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const manageableCategories = useMemo(() => getManageableCategories(snapshot.categories), [snapshot.categories]);
  const monthTransactions = useMemo(
    () => snapshot.transactions.filter((transaction) => isSettledTransactionStatus(transaction.status) && isSameMonth(parseISO(transaction.occurred_at), month)),
    [month, snapshot.transactions],
  );
  const categoryTree = useMemo(() => buildCategoryTree(manageableCategories, monthTransactions), [manageableCategories, monthTransactions]);
  const expenseNodes = useMemo(() => sortNodesByActivity(categoryTree.filter((node) => node.type === "expense")), [categoryTree]);
  const incomeNodes = useMemo(() => sortNodesByActivity(categoryTree.filter((node) => node.type === "income")), [categoryTree]);
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

  const sectionProps = {
    month,
    transactions: monthTransactions,
    snapshot,
    editMode,
    editor,
    manageableCategories,
    selectedCategoryId,
    onSelectCategory: setSelectedCategoryId,
    onEditState: setEditor,
    onSave: saveCategory,
    onDelete: setDeletingCategory,
  };

  return (
    <>
      <div className="mobile-nav-scroll-clearance h-full overflow-y-auto bg-background [scroll-padding-bottom:calc(76px+env(safe-area-inset-bottom))] lg:[scroll-padding-bottom:1rem]">
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

        <section className="px-4 pb-4 sm:px-6 lg:px-7">
          <BudgetBarChart
            transactions={snapshot.transactions}
            categories={manageableCategories}
            currentMonth={month}
            targetCurrency={snapshot.preferences.default_currency}
            exchangeRates={snapshot.exchange_rates}
            onMonthSelect={setSelectedMonthReport}
          />
          <div className="mt-3 grid grid-cols-[44px_minmax(0,1fr)_44px] items-center gap-2">
            <PageHeaderIconButton icon={ChevronLeft} label={t("monthChart.previousMonth")} onClick={() => changeMonth(addMonths(month, -1))} />
            <Button variant="ghost" onClick={() => changeMonth(today)} className="min-w-0 justify-center bg-transparent">
              <span className="truncate">{formatDate.dateTime(calDate(month), { month: "long", year: "numeric" })}</span>
            </Button>
            <PageHeaderIconButton icon={ChevronRight} label={t("monthChart.nextMonth")} onClick={() => changeMonth(addMonths(month, 1))} />
          </div>
        </section>

        {/* Two-Panel Layout */}
        <div className="grid grid-cols-1 gap-6 px-4 pb-8 sm:px-6 lg:grid-cols-[400px_minmax(0,1fr)] lg:px-7">
          {/* Left Column: Category Inventory */}
          <div className="flex flex-col gap-8">
            <CategorySection title={t("sections.expensesTitle")} type="expense" nodes={expenseNodes} emptyMessage={t("sections.expensesEmpty")} {...sectionProps} />
            <CategorySection title={t("sections.incomeTitle")} type="income" nodes={incomeNodes} emptyMessage={t("sections.incomeEmpty")} {...sectionProps} />
          </div>

          {/* Right Column: Selected Category Details / Register */}
          <div className="flex flex-col">
            {selectedCategoryId ? (
              <CategoryDetailsPanel
                key={selectedCategoryId}
                nodeId={selectedCategoryId}
                month={month}
                transactions={monthTransactions}
                snapshot={snapshot}
                editMode={editMode}
                editor={editor}
                manageableCategories={manageableCategories}
                onSelectCategory={setSelectedCategoryId}
                onEditState={setEditor}
                onSave={saveCategory}
                onDelete={setDeletingCategory}
              />
            ) : (
              <Surface tone="panel" padding="lg" className="flex h-full min-h-[300px] flex-col items-center justify-center text-center">
                <EmptyState
                  title={t("category.selectPrompt")}
                  description={t("category.selectPromptDesc")}
                />
              </Surface>
            )}
          </div>
        </div>
      </div>

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
