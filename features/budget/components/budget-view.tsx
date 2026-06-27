"use client";

import { addMonths, isSameMonth, parseISO, startOfToday } from "date-fns";
import { ChevronDown, ChevronLeft, ChevronRight, Ellipsis, PencilLine, Plus, Settings2, Trash2 } from "lucide-react";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { BudgetBarChart } from "@/features/budget/components/budget-bar-chart";
import { BudgetInlineCategoryEditor } from "@/features/budget/components/budget-inline-category-editor";
import { BudgetMonthAnalysisSheet } from "@/features/budget/components/budget-month-analysis-sheet";
import { getConvertedCategoryTotal } from "@/features/budget/lib/budget-analytics";
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

function CategoryActions({
  node,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: CategoryTreeNode;
  onAddChild: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const t = useTranslations("categories.tree");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={t("openMenu", { name: node.name })}
          />
        }
      >
        <Ellipsis />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onAddChild}><Plus />{t("addChild")}</DropdownMenuItem>
          <DropdownMenuItem onClick={onEdit}><PencilLine />{t("editCategory")}</DropdownMenuItem>
          {node.purpose ? null : (
            <DropdownMenuItem variant="destructive" onClick={onDelete}><Trash2 />{t("deleteCategory")}</DropdownMenuItem>
          )}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
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

function ManagedCategoryBranch({
  node,
  categories,
  editor,
  onEditState,
  onSave,
  onDelete,
}: {
  node: CategoryTreeNode;
  categories: Category[];
  editor: CategoryEditorState | null;
  onEditState: (editor: CategoryEditorState | null) => void;
  onSave: (editor: CategoryEditorState, values: CategoryInput) => void;
  onDelete: (category: Category) => void;
}) {
  const editingHere = editor?.mode === "edit" && editor.category.id === node.id;
  const addingHere = editor?.mode === "add" && editor.parentId === node.id;
  return (
    <div className="border-b border-border/35 last:border-b-0">
      <div className="flex min-h-11 items-center gap-3 px-2 py-1.5 hover:bg-secondary/50">
        <CategoryIcon icon={node.icon} glyphClassName="size-4 shrink-0 text-muted-foreground" />
        <span className="type-body-14 min-w-0 flex-1 truncate">{node.name}</span>
        <CategoryActions
          node={node}
          onAddChild={() => onEditState({ mode: "add", type: node.type, parentId: node.id })}
          onEdit={() => onEditState({ mode: "edit", category: node })}
          onDelete={() => onDelete(node)}
        />
      </div>
      {editingHere || addingHere ? (
        <InlineEditor
          editor={editor!}
          categories={categories}
          onSave={(values) => onSave(editor!, values)}
          onCancel={() => onEditState(null)}
        />
      ) : null}
      {node.children.length ? (
        <div className="ml-5 border-l border-border/50 pl-2">
          {node.children.map((child) => (
            <ManagedCategoryBranch
              key={child.id}
              node={child}
              categories={categories}
              editor={editor}
              onEditState={onEditState}
              onSave={onSave}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CategoryRow({
  node,
  month,
  transactions,
  snapshot,
  selected,
  editMode,
  editor,
  manageableCategories,
  onSelect,
  onEditState,
  onSave,
  onDelete,
}: {
  node: CategoryTreeNode;
  month: Date;
  transactions: Transaction[];
  snapshot: FinanceSnapshot;
  selected: boolean;
  editMode: boolean;
  editor: CategoryEditorState | null;
  manageableCategories: Category[];
  onSelect: () => void;
  onEditState: (editor: CategoryEditorState | null) => void;
  onSave: (editor: CategoryEditorState, values: CategoryInput) => void;
  onDelete: (category: Category) => void;
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
  const editingHere = editor?.mode === "edit" && editor.category.id === node.id;
  const addingHere = editor?.mode === "add" && editor.parentId === node.id;

  return (
    <div className="border-b border-border/40 last:border-b-0">
      <div className={cn(
        "flex min-h-14 items-center gap-3 rounded-[var(--radius-control)] px-2 py-2",
        !editMode && "hover:bg-secondary/50",
        selected && !editMode && "bg-secondary/60",
      )}>
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={editMode ? undefined : onSelect}
          aria-expanded={editMode ? undefined : selected}
        >
          <CategoryIcon icon={node.icon} glyphClassName="size-[18px] shrink-0 text-muted-foreground" />
          <span className="min-w-0 flex-1">
            <span className="type-body-14 block truncate font-medium text-foreground">{node.name}</span>
            <span className="type-body-12 block truncate text-muted-foreground">{t("category.childCount", { count: node.children.length })}</span>
          </span>
          {total.amount === null ? (
            <span className="type-body-12 shrink-0 text-muted-foreground">{t("category.rateUnavailable")}</span>
          ) : (
            <MoneyAmount amount={total.amount} currency={snapshot.preferences.default_currency} display="absolute" className="shrink-0 type-body-14 font-medium" />
          )}
          {!editMode ? <ChevronDown className={cn("shrink-0 text-muted-foreground transition-transform", selected && "rotate-180")} /> : null}
        </button>
        {editMode ? (
          <CategoryActions
            node={node}
            onAddChild={() => onEditState({ mode: "add", type: node.type, parentId: node.id })}
            onEdit={() => onEditState({ mode: "edit", category: node })}
            onDelete={() => onDelete(node)}
          />
        ) : null}
      </div>

      {editMode && (editingHere || addingHere) ? (
        <InlineEditor editor={editor!} categories={manageableCategories} onSave={(values) => onSave(editor!, values)} onCancel={() => onEditState(null)} />
      ) : null}

      {editMode ? (
        node.children.length ? (
          <div className="ml-5 border-l border-border/50 pl-2">
            {node.children.map((child) => (
              <ManagedCategoryBranch
                key={child.id}
                node={child}
                categories={manageableCategories}
                editor={editor}
                onEditState={onEditState}
                onSave={onSave}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : null
      ) : selected ? (
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
          <TransactionList transactions={linkedTransactions} emptyMessage={t("category.noTransactions")} groupByDate showMinorUnits />
        </div>
      ) : null}
    </div>
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
    <section className="border-t border-border/40 px-4 py-5 sm:px-6 lg:px-7">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h2 className="type-body-12 font-semibold uppercase tracking-[0.18em] text-muted-foreground">{title}</h2>
        {editMode ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onEditState({ mode: "add", type, parentId: null })}>
            <Plus data-icon="inline-start" />{commonT("add")}
          </Button>
        ) : null}
      </div>
      {addingRoot ? <InlineEditor editor={editor} categories={manageableCategories} onSave={(values) => onSave(editor, values)} onCancel={() => onEditState(null)} /> : null}
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
              editMode={editMode}
              editor={editor}
              manageableCategories={manageableCategories}
              onSelect={() => onSelectCategory(selectedCategoryId === node.id ? null : node.id)}
              onEditState={onEditState}
              onSave={onSave}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : !addingRoot ? <EmptyState title={emptyMessage} description="" /> : null}
    </section>
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
      <div className="mobile-nav-scroll-clearance h-full overflow-y-auto bg-background [scroll-padding-bottom:calc(76px+env(safe-area-inset-bottom))]">
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

        <CategorySection title={t("sections.expensesTitle")} type="expense" nodes={expenseNodes} emptyMessage={t("sections.expensesEmpty")} {...sectionProps} />
        <CategorySection title={t("sections.incomeTitle")} type="income" nodes={incomeNodes} emptyMessage={t("sections.incomeEmpty")} {...sectionProps} />
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
