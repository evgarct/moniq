"use client";

import { ChevronDown, ChevronLeft, ChevronUp, PencilLine, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { CategoryIcon } from "@/components/category-icon";
import { MoneyAmount } from "@/components/money-amount";
import { ProgressTrack } from "@/components/progress-track";
import { Surface } from "@/components/surface";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BudgetInlineCategoryEditor } from "@/features/budget/components/budget-inline-category-editor";
import { parseCategoryDescriptionAndBudget, serializeCategoryDescriptionAndBudget } from "@/features/budget/lib/budget-analytics";
import { buildEnvelopeBudgetRows } from "@/features/budget/lib/envelope-budget";
import { buildCategoryTree, getCategoryDescendantIds } from "@/features/categories/lib/category-tree";
import { TransactionFormSheet, type TransactionFormSubmitPayload } from "@/features/transactions/components/transaction-form-sheet";
import { useTransactionActions } from "@/features/transactions/hooks/use-transaction-actions";
import { useTransactionListActions } from "@/features/transactions/hooks/use-transaction-list-actions";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";
import type { Category, CategoryTreeNode, CategoryType, FinanceSnapshot, Transaction } from "@/types/finance";
import type { CategoryInput } from "@/types/finance-schemas";

export type CategoryEditorState =
  | { mode: "add"; type: CategoryType; parentId: string | null }
  | { mode: "edit"; category: Category };

export function findCategoryTreeNode(nodes: CategoryTreeNode[], id: string): CategoryTreeNode | null {
  for (const node of nodes) {
    if (node.id === id) return node;
    const found = findCategoryTreeNode(node.children, id);
    if (found) return found;
  }
  return null;
}

export function buildCategoryPath(nodeId: string, categories: Category[]): Category[] {
  const path: Category[] = [];
  let current = categories.find((category) => category.id === nodeId);
  while (current) {
    path.unshift(current);
    const parentId = current.parent_id;
    current = parentId ? categories.find((category) => category.id === parentId) : undefined;
  }
  return path;
}

export function InlineEditor({
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

function InlineBudgetInput({
  category,
  currency,
  onSave,
}: {
  category: Category;
  currency: string;
  onSave: (values: CategoryInput) => void;
}) {
  const t = useTranslations("budget.envelope");
  const parsed = useMemo(() => parseCategoryDescriptionAndBudget(category.description), [category.description]);
  const [value, setValue] = useState(parsed.plannedBudget !== null ? String(parsed.plannedBudget) : "");

  const commit = () => {
    const trimmed = value.trim();
    const budgetValue = trimmed === "" ? null : parseFloat(trimmed);
    if (budgetValue === parsed.plannedBudget || (budgetValue !== null && Number.isNaN(budgetValue))) return;

    onSave({
      name: category.name,
      description: serializeCategoryDescriptionAndBudget(parsed.description, budgetValue) || null,
      icon: category.icon,
      type: category.type,
      parent_id: category.parent_id,
    });
  };

  return (
    <div className="mt-0.5 flex items-center gap-1.5">
      <Input
        type="number"
        inputMode="decimal"
        step="any"
        min="0"
        placeholder={t("setBudget")}
        aria-label={t("setBudget")}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === "Enter") event.currentTarget.blur();
        }}
        className="h-9 w-28 border-border/40 bg-background/50 px-2 text-[15px] font-medium tabular-nums focus:bg-background focus:ring-1 focus:ring-ring/25"
      />
      <span className="text-sm text-muted-foreground">{currency}</span>
    </div>
  );
}

function SubcategoryRow({
  name,
  icon,
  spent,
  share,
  currency,
  onSelect,
}: {
  name: string;
  icon: string | null;
  spent: number | null;
  share: number;
  currency: CurrencyCode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="grid min-h-11 w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 rounded-sm px-1.5 py-2 text-left outline-none transition-[background-color] hover:bg-secondary/70 active:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/25"
    >
      <span className="flex min-w-0 items-center gap-2">
        <CategoryIcon icon={icon} glyphClassName="size-4 shrink-0 text-muted-foreground" />
        <span className="truncate text-[13px] leading-[18px] font-medium text-foreground">{name}</span>
      </span>
      <span className="text-[13px] leading-[18px] font-medium">
        {spent === null ? <span className="text-muted-foreground">—</span> : <MoneyAmount amount={spent} currency={currency} display="absolute" tone={spent === 0 ? "muted" : "default"} showMinorUnits={false} />}
      </span>
      {spent ? (
        <span className="col-span-2 pl-6">
          <ProgressTrack value={share} className="h-0.5" trackClassName="bg-border/55" fillClassName="bg-foreground/62" />
        </span>
      ) : null}
    </button>
  );
}

/**
 * Detail of one envelope or subcategory: plan, spend and what is left, its subcategories as flat rows
 * and (collapsed) its transactions. Rendered in a panel on desktop and on a fullscreen surface below `lg`.
 */
export function EnvelopeDetail({
  nodeId,
  month,
  transactions,
  snapshot,
  editMode,
  editor,
  manageableCategories,
  variant,
  backLabel,
  onBack,
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
  variant: "panel" | "screen";
  backLabel: string;
  onBack: () => void;
  onSelectCategory: (id: string) => void;
  onEditState: (state: CategoryEditorState | null) => void;
  onSave: (editor: CategoryEditorState, values: CategoryInput) => void;
  onDelete: (category: Category) => void;
}) {
  const t = useTranslations("budget");
  const envelopeT = useTranslations("budget.envelope");
  const summaryT = useTranslations("budget.summary");
  const categoriesTreeT = useTranslations("categories.tree");
  const currency = snapshot.preferences.default_currency;
  const [showTransactions, setShowTransactions] = useState(false);
  const transactionActions = useTransactionActions();
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [transactionSheetMode, setTransactionSheetMode] = useState<"edit-transaction" | "edit-schedule">("edit-transaction");
  const [transactionSheetOpen, setTransactionSheetOpen] = useState(false);
  const listActions = useTransactionListActions({
    onEdit(transaction) {
      setTransactionSheetMode("edit-transaction");
      setEditingTransaction(transaction);
      setTransactionSheetOpen(true);
    },
    onEditSeries(transaction) {
      setTransactionSheetMode("edit-schedule");
      setEditingTransaction(transaction);
      setTransactionSheetOpen(true);
    },
  });

  const node = useMemo(
    () => findCategoryTreeNode(buildCategoryTree(manageableCategories, transactions), nodeId),
    [manageableCategories, transactions, nodeId],
  );
  const categoryIds = useMemo(
    () => new Set(node ? [node.id, ...getCategoryDescendantIds(snapshot.categories, node.id)] : []),
    [node, snapshot.categories],
  );
  const row = useMemo(
    () =>
      node
        ? buildEnvelopeBudgetRows({ nodes: [node], categories: snapshot.categories, transactions, month, targetCurrency: currency, exchangeRates: snapshot.exchange_rates })[0]
        : null,
    [node, snapshot.categories, snapshot.exchange_rates, transactions, month, currency],
  );
  const childRows = useMemo(
    () =>
      node
        ? buildEnvelopeBudgetRows({ nodes: node.children, categories: snapshot.categories, transactions, month, targetCurrency: currency, exchangeRates: snapshot.exchange_rates })
        : [],
    [node, snapshot.categories, snapshot.exchange_rates, transactions, month, currency],
  );
  const linkedTransactions = useMemo(
    () => transactions.filter((transaction) => transaction.category_id && categoryIds.has(transaction.category_id)),
    [transactions, categoryIds],
  );

  if (!node || !row) return null;

  const editingHere = editor?.mode === "edit" && editor.category.id === node.id;
  const addingHere = editor?.mode === "add" && editor.parentId === node.id;
  const canPlan = node.type === "expense" && !node.parent_id;
  const over = row.status === "over";
  const ratio = row.planned && row.spent !== null ? row.spent / row.planned : 0;
  const spentTotal = row.spent ?? 0;

  if (editMode && (editingHere || addingHere)) {
    return (
      <div className={cn(variant === "screen" ? "px-4 pb-8 pt-2" : "mt-4")}>
        <InlineEditor editor={editor!} categories={manageableCategories} onSave={(values) => onSave(editor!, values)} onCancel={() => onEditState(null)} />
      </div>
    );
  }

  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onBack} className="h-11 px-2 text-muted-foreground hover:text-foreground lg:h-9">
          <ChevronLeft className="mr-1 size-4 shrink-0" />
          <span>{backLabel}</span>
        </Button>

        {editMode ? (
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => onEditState({ mode: "add", type: node.type, parentId: node.id })}>
              <Plus className="mr-1.5 size-4" />
              {categoriesTreeT("addChild")}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onEditState({ mode: "edit", category: node })}>
              <PencilLine className="mr-1.5 size-4" />
              {categoriesTreeT("editCategory")}
            </Button>
            {node.purpose ? null : (
              <Button type="button" variant="ghost" size="sm" onClick={() => onDelete(node)} className="text-destructive hover:bg-destructive/10 hover:text-destructive">
                <Trash2 className="mr-1.5 size-4" />
                {categoriesTreeT("deleteCategory")}
              </Button>
            )}
          </div>
        ) : null}
      </div>

      <div className="flex items-start gap-3">
        <CategoryIcon icon={node.icon} glyphClassName="mt-1 size-5 shrink-0 text-muted-foreground" />
        <div className="min-w-0">
          <h3 className="type-h4 font-serif">{node.name}</h3>
          {row.description ? <p className="type-body-14 mt-1 max-w-xl text-muted-foreground">{row.description}</p> : null}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <dl className="grid grid-cols-3 gap-3">
          <div className="min-w-0">
            <dt className="type-body-12 text-muted-foreground">{summaryT("planned")}</dt>
            <dd className="mt-0.5 text-[17px] leading-6 font-medium tabular-nums">
              {!canPlan ? (
                <span className="text-muted-foreground">—</span>
              ) : editMode ? (
                row.planned !== null ? <MoneyAmount amount={row.planned} currency={currency} display="absolute" showMinorUnits={false} /> : <span className="text-muted-foreground">—</span>
              ) : (
                <InlineBudgetInput key={node.id} category={node} currency={currency} onSave={(values) => onSave(editor || { mode: "edit", category: node }, values)} />
              )}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="type-body-12 text-muted-foreground">{summaryT("spent")}</dt>
            <dd className="mt-0.5 text-[17px] leading-6 font-medium tabular-nums">
              {row.spent !== null ? <MoneyAmount amount={row.spent} currency={currency} display="absolute" showMinorUnits={false} /> : "—"}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="type-body-12 text-muted-foreground">{over ? envelopeT("over") : summaryT("left")}</dt>
            <dd className="mt-0.5 text-[17px] leading-6 font-medium tabular-nums">
              {row.left !== null ? <MoneyAmount amount={Math.abs(row.left)} currency={currency} display="absolute" tone={over ? "negative" : "default"} showMinorUnits={false} /> : "—"}
            </dd>
          </div>
        </dl>
        {row.planned ? (
          <ProgressTrack value={ratio} className="h-1" trackClassName="bg-border/55" fillClassName={over ? "bg-destructive" : "bg-foreground/62"} />
        ) : null}
        {row.spent === null ? <p className="type-body-12 text-muted-foreground">{summaryT("missingRates")}</p> : null}
      </div>

      {childRows.length ? (
        <div className="flex flex-col gap-1">
          <span className="type-body-12 font-semibold uppercase tracking-[0.18em] text-muted-foreground">{t("category.subcategories")}</span>
          <div className="flex flex-col">
            {childRows.map((child) => (
              <SubcategoryRow
                key={child.id}
                name={child.name}
                icon={child.icon}
                spent={child.spent}
                share={spentTotal > 0 && child.spent !== null ? child.spent / spentTotal : 0}
                currency={currency}
                onSelect={() => onSelectCategory(child.id)}
              />
            ))}
          </div>
        </div>
      ) : null}

      <div className="border-t border-border/40 pt-3">
        <Button type="button" variant="ghost" onClick={() => setShowTransactions((current) => !current)} aria-expanded={showTransactions} className="h-11 w-full justify-between px-1.5">
          <span>{showTransactions ? t("category.hideTransactions") : t("category.showTransactions", { count: String(linkedTransactions.length) })}</span>
          {showTransactions ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
        </Button>
        {showTransactions ? (
          <div className="mt-2">
            <TransactionList
              transactions={linkedTransactions}
              emptyMessage={t("category.noTransactions")}
              groupByDate
              showMinorUnits
              targetCurrency={currency}
              exchangeRates={snapshot.exchange_rates}
              onTransactionClick={listActions.onEditOccurrence}
              {...listActions}
            />
          </div>
        ) : null}
      </div>
    </>
  );

  return (
    <>
      {variant === "panel" ? (
        <Surface tone="panel" padding="md" className="flex flex-col gap-4">{body}</Surface>
      ) : (
        <div className="flex flex-col gap-4 px-4 pb-8 pt-2">{body}</div>
      )}
      <TransactionFormSheet
        open={transactionSheetOpen}
        mode={transactionSheetMode}
        transaction={editingTransaction}
        schedule={transactionSheetMode === "edit-schedule" ? editingTransaction?.schedule ?? null : null}
        accounts={snapshot.accounts}
        categories={snapshot.categories}
        allocations={snapshot.allocations}
        investmentPositions={snapshot.investment_positions}
        onOpenChange={setTransactionSheetOpen}
        onSubmit={(payload: TransactionFormSubmitPayload) => {
          if (payload.kind === "transaction" && editingTransaction) {
            transactionActions.updateTransactionOptimistic(editingTransaction.id, payload.values);
          } else if (payload.kind === "recurring-occurrence-series") {
            transactionActions.applyRecurringOccurrenceChanges(payload.scheduleId, payload.fromOccurrenceDate, payload.changes);
          } else if (payload.kind === "schedule" && editingTransaction?.schedule) {
            transactionActions.updateSchedule(editingTransaction.schedule.id, payload.values);
          }
        }}
      />
    </>
  );
}
