"use client";

import { Ellipsis, PencilLine, Plus, Trash2 } from "lucide-react";
import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { CategoryIcon } from "@/components/category-icon";
import { DetailField, DetailFieldGrid } from "@/components/detail-field";
import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import {
  Surface,
  SurfaceDescription,
  SurfaceEyebrow,
  SurfaceHeader,
  SurfaceTitle,
} from "@/components/surface";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getCategoryDescendantIds } from "@/features/categories/lib/category-tree";
import { cn } from "@/lib/utils";
import type { Category, CategoryTreeNode, CategoryType, Transaction } from "@/types/finance";

type CategoryWorkspaceProps = {
  nodes: CategoryTreeNode[];
  categories: Category[];
  transactions: Transaction[];
  selectedCategoryId: string | null;
  selectedType: CategoryType;
  onSelectCategory: (categoryId: string | null) => void;
  onTypeChange: (type: CategoryType) => void;
  onAddCategory: () => void;
  onAddChild: (node: CategoryTreeNode) => void;
  onEdit: (node: CategoryTreeNode) => void;
  onDelete: (node: CategoryTreeNode) => void;
  onEditOccurrence?: (transaction: Transaction) => void;
  onEditSeries?: (transaction: Transaction) => void;
  onDeleteTransaction?: (transaction: Transaction) => void;
  onDeleteSeries?: (transaction: Transaction) => void;
  onMarkPaid?: (transaction: Transaction) => void;
  onSkipOccurrence?: (transaction: Transaction) => void;
  onToggleScheduleState?: (transaction: Transaction) => void;
  fallback: React.ReactNode;
};

type CategoryRowProps = {
  node: CategoryTreeNode;
  parentPath: string[];
  selectedCategoryId: string | null;
  transactions: Transaction[];
  onSelectCategory: (categoryId: string | null) => void;
  onAddChild: (node: CategoryTreeNode) => void;
  onEdit: (node: CategoryTreeNode) => void;
  onDelete: (node: CategoryTreeNode) => void;
};

function collectCategoryIds(node: CategoryTreeNode): string[] {
  return [node.id, ...node.children.flatMap(collectCategoryIds)];
}

function getLinkedTransactions(transactions: Transaction[], categoryIds: Set<string>) {
  return transactions.filter((transaction) => transaction.category_id && categoryIds.has(transaction.category_id));
}

function flattenNodes(nodes: CategoryTreeNode[]): CategoryTreeNode[] {
  return nodes.flatMap((node) => [node, ...flattenNodes(node.children)]);
}

function findNode(nodes: CategoryTreeNode[], categoryId: string | null): CategoryTreeNode | null {
  if (!categoryId) return null;

  for (const node of nodes) {
    if (node.id === categoryId) return node;
    const child = findNode(node.children, categoryId);
    if (child) return child;
  }

  return null;
}

function findParentName(categories: Category[], node: CategoryTreeNode) {
  if (!node.parent_id) return null;
  return categories.find((category) => category.id === node.parent_id)?.name ?? null;
}

function CategoryActions({
  node,
  onAddChild,
  onEdit,
  onDelete,
}: {
  node: CategoryTreeNode;
  onAddChild: (node: CategoryTreeNode) => void;
  onEdit: (node: CategoryTreeNode) => void;
  onDelete: (node: CategoryTreeNode) => void;
}) {
  const t = useTranslations("categories.tree");

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger
          render={
            <DropdownMenuTrigger
              render={
                <Button
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:bg-secondary/70 hover:text-foreground"
                  aria-label={t("openMenu", { name: node.name })}
                />
              }
            >
              <Ellipsis className="h-4 w-4" />
            </DropdownMenuTrigger>
          }
        />
        <TooltipContent>{t("openMenu", { name: node.name })}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent className="w-44 p-1.5">
        <DropdownMenuItem className="px-2 py-2 text-[13px]" onClick={() => onAddChild(node)}>
          <Plus className="h-4 w-4" />
          {t("addChild")}
        </DropdownMenuItem>
        <DropdownMenuItem className="px-2 py-2 text-[13px]" onClick={() => onEdit(node)}>
          <PencilLine className="h-4 w-4" />
          {t("editCategory")}
        </DropdownMenuItem>
        <DropdownMenuItem className="px-2 py-2 text-[13px]" variant="destructive" onClick={() => onDelete(node)}>
          <Trash2 className="h-4 w-4" />
          {t("deleteCategory")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function CategoryTreeRegisterRow({
  node,
  parentPath,
  selectedCategoryId,
  transactions,
  onSelectCategory,
  onAddChild,
  onEdit,
  onDelete,
}: CategoryRowProps) {
  const t = useTranslations("categories.tree");
  const isSelected = selectedCategoryId === node.id;
  const categoryIds = useMemo(() => new Set(collectCategoryIds(node)), [node]);
  const linkedCount = getLinkedTransactions(transactions, categoryIds).length;
  const path = parentPath.length ? parentPath.join(" / ") : t("topLevel");

  return (
    <div className="space-y-1">
      <div
        className={cn(
          "group/category-row flex items-center gap-2 rounded-[var(--radius-control)] px-2 py-2.5 transition-[background-color]",
          isSelected ? "bg-secondary/70" : "hover:bg-secondary/50",
        )}
      >
        <button
          type="button"
          className="flex min-w-0 flex-1 items-center gap-3 text-left"
          onClick={() => onSelectCategory(isSelected ? null : node.id)}
        >
          <CategoryIcon icon={node.icon} glyphClassName="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="type-body-14 truncate font-medium text-foreground">{node.name}</p>
            <p className="type-body-12 truncate text-muted-foreground">
              {path} / {t("linkedTransactions", { count: linkedCount })}
            </p>
          </div>
          <div className="hidden shrink-0 text-right sm:block">
            {node.totals_by_currency.length ? (
              <span className="inline-grid gap-0.5">
                {node.totals_by_currency.map((total) => (
                  <MoneyAmount
                    key={total.currency}
                    amount={total.amount}
                    currency={total.currency}
                    display="absolute"
                    className="text-sm font-medium tabular-nums text-foreground"
                  />
                ))}
              </span>
            ) : (
              <span className="type-body-12 text-muted-foreground">{t("noSpendYet")}</span>
            )}
          </div>
        </button>

        <div className="opacity-100 sm:opacity-0 sm:transition-opacity sm:group-hover/category-row:opacity-100 sm:group-focus-within/category-row:opacity-100">
          <CategoryActions node={node} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} />
        </div>
      </div>

      {node.children.length ? (
        <div className="ml-5 space-y-1 border-l border-border/60 pl-3">
          {node.children.map((child) => (
            <CategoryTreeRegisterRow
              key={child.id}
              node={child}
              parentPath={[...parentPath, node.name]}
              selectedCategoryId={selectedCategoryId}
              transactions={transactions}
              onSelectCategory={onSelectCategory}
              onAddChild={onAddChild}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function CategoryInventory({
  nodes,
  selectedCategoryId,
  selectedType,
  transactions,
  onSelectCategory,
  onTypeChange,
  onAddCategory,
  onAddChild,
  onEdit,
  onDelete,
}: Pick<
  CategoryWorkspaceProps,
  | "nodes"
  | "selectedCategoryId"
  | "selectedType"
  | "transactions"
  | "onSelectCategory"
  | "onTypeChange"
  | "onAddCategory"
  | "onAddChild"
  | "onEdit"
  | "onDelete"
>) {
  const viewT = useTranslations("categories.view");
  const formT = useTranslations("categories.form");
  const visibleNodes = nodes.filter((node) => node.type === selectedType);

  return (
    <Surface tone="panel" padding="lg" className="flex min-h-[560px] flex-col border border-black/5">
      <SurfaceHeader
        action={
          <Button onClick={onAddCategory}>
            <Plus className="h-4 w-4" />
            {viewT("add")}
          </Button>
        }
      >
        <SurfaceEyebrow>{viewT("eyebrow")}</SurfaceEyebrow>
        <SurfaceTitle>{viewT("title")}</SurfaceTitle>
        <SurfaceDescription>{viewT("description")}</SurfaceDescription>
      </SurfaceHeader>

      <div className="mt-5 flex items-center justify-between gap-3 px-1">
        <ToggleGroup
          value={[selectedType]}
          onValueChange={(value) => {
            const nextType = value[0];
            if (nextType === "expense" || nextType === "income") onTypeChange(nextType);
          }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="expense">{formT("types.expense")}</ToggleGroupItem>
          <ToggleGroupItem value="income">{formT("types.income")}</ToggleGroupItem>
        </ToggleGroup>
        <p className="type-body-12 text-muted-foreground">
          {viewT("categoryCount", { count: flattenNodes(visibleNodes).length })}
        </p>
      </div>

      <div className="mt-4 min-h-0 flex-1 overflow-y-auto">
        {visibleNodes.length ? (
          <div className="space-y-1">
            {visibleNodes.map((node) => (
              <CategoryTreeRegisterRow
                key={node.id}
                node={node}
                parentPath={[]}
                selectedCategoryId={selectedCategoryId}
                transactions={transactions}
                onSelectCategory={onSelectCategory}
                onAddChild={onAddChild}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            ))}
          </div>
        ) : (
          <EmptyState title={viewT("emptyTitle")} description={viewT("emptyDescription")} />
        )}
      </div>
    </Surface>
  );
}

function CategoryDetail({
  node,
  categories,
  transactions,
  onAddChild,
  onEdit,
  onDelete,
  actionCallbacks,
}: {
  node: CategoryTreeNode;
  categories: Category[];
  transactions: Transaction[];
  onAddChild: (node: CategoryTreeNode) => void;
  onEdit: (node: CategoryTreeNode) => void;
  onDelete: (node: CategoryTreeNode) => void;
  actionCallbacks: Pick<
    CategoryWorkspaceProps,
    | "onEditOccurrence"
    | "onEditSeries"
    | "onDeleteTransaction"
    | "onDeleteSeries"
    | "onMarkPaid"
    | "onSkipOccurrence"
    | "onToggleScheduleState"
  >;
}) {
  const detailT = useTranslations("categories.detail");
  const formT = useTranslations("categories.form");
  const linkedCategoryIds = useMemo(() => new Set([node.id, ...getCategoryDescendantIds(categories, node.id)]), [categories, node.id]);
  const linkedTransactions = useMemo(() => getLinkedTransactions(transactions, linkedCategoryIds), [linkedCategoryIds, transactions]);
  const parentName = findParentName(categories, node);

  return (
    <Surface tone="panel" padding="lg" className="flex min-h-[560px] flex-col border border-black/5">
      <SurfaceHeader
        action={
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onEdit(node)}>{detailT("edit")}</Button>
            <Button onClick={() => onAddChild(node)}>
              <Plus className="h-4 w-4" />
              {detailT("addChild")}
            </Button>
            <CategoryActions node={node} onAddChild={onAddChild} onEdit={onEdit} onDelete={onDelete} />
          </div>
        }
      >
        <SurfaceEyebrow>{detailT("eyebrow")}</SurfaceEyebrow>
        <div className="mt-1 flex min-w-0 items-center gap-2">
          <CategoryIcon icon={node.icon} glyphClassName="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
          <SurfaceTitle className="truncate">{node.name}</SurfaceTitle>
        </div>
        <SurfaceDescription>
          {parentName ? detailT("pathWithParent", { parent: parentName }) : detailT("pathTopLevel")}
        </SurfaceDescription>
      </SurfaceHeader>

      <div className="mt-5 grid gap-5">
        <DetailFieldGrid>
          <DetailField label={detailT("fields.type")}>
            {node.type === "expense" ? formT("types.expense") : formT("types.income")}
          </DetailField>
          <DetailField label={detailT("fields.parent")}>{parentName ?? detailT("topLevel")}</DetailField>
          <DetailField label={detailT("fields.children")}>
            {detailT("childrenCount", { count: node.children.length })}
          </DetailField>
          <DetailField label={detailT("fields.linked")}>
            {detailT("linkedTransactions", { count: linkedTransactions.length })}
          </DetailField>
        </DetailFieldGrid>

        <div className="grid gap-2">
          <p className="type-body-12 px-1 font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {detailT("totals")}
          </p>
          <div className="space-y-1">
            {node.totals_by_currency.length ? (
              node.totals_by_currency.map((total) => (
                <div key={total.currency} className="flex items-center justify-between rounded-[var(--radius-control)] px-2 py-2 hover:bg-secondary/50">
                  <span className="type-body-12 text-muted-foreground">{total.currency}</span>
                  <MoneyAmount
                    amount={total.amount}
                    currency={total.currency}
                    display="absolute"
                    className="text-sm font-medium tabular-nums text-foreground"
                  />
                </div>
              ))
            ) : (
              <p className="type-body-14 px-2 py-2 text-muted-foreground">{detailT("noTotals")}</p>
            )}
          </div>
        </div>

        {node.children.length ? (
          <div className="grid gap-2">
            <p className="type-body-12 px-1 font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              {detailT("children")}
            </p>
            <div className="space-y-1">
              {node.children.map((child) => (
                <div key={child.id} className="flex items-center gap-3 rounded-[var(--radius-control)] px-2 py-2 hover:bg-secondary/50">
                  <CategoryIcon icon={child.icon} glyphClassName="h-[18px] w-[18px] shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="type-body-14 truncate font-medium text-foreground">{child.name}</p>
                    <p className="type-body-12 text-muted-foreground">
                      {detailT("childrenCount", { count: child.children.length })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-2">
          <p className="type-body-12 px-1 font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            {detailT("activity")}
          </p>
          <TransactionList
            transactions={linkedTransactions}
            emptyMessage={detailT("emptyActivity")}
            groupByDate
            onEditOccurrence={actionCallbacks.onEditOccurrence}
            onEditSeries={actionCallbacks.onEditSeries}
            onDeleteTransaction={actionCallbacks.onDeleteTransaction}
            onDeleteSeries={actionCallbacks.onDeleteSeries}
            onMarkPaid={actionCallbacks.onMarkPaid}
            onSkipOccurrence={actionCallbacks.onSkipOccurrence}
            onToggleScheduleState={actionCallbacks.onToggleScheduleState}
          />
        </div>
      </div>
    </Surface>
  );
}

export function CategoryWorkspace({
  nodes,
  categories,
  transactions,
  selectedCategoryId,
  selectedType,
  onSelectCategory,
  onTypeChange,
  onAddCategory,
  onAddChild,
  onEdit,
  onDelete,
  onEditOccurrence,
  onEditSeries,
  onDeleteTransaction,
  onDeleteSeries,
  onMarkPaid,
  onSkipOccurrence,
  onToggleScheduleState,
  fallback,
}: CategoryWorkspaceProps) {
  const selectedNode = findNode(nodes, selectedCategoryId);

  return (
    <>
      <CategoryInventory
        nodes={nodes}
        selectedCategoryId={selectedCategoryId}
        selectedType={selectedType}
        transactions={transactions}
        onSelectCategory={onSelectCategory}
        onTypeChange={onTypeChange}
        onAddCategory={onAddCategory}
        onAddChild={onAddChild}
        onEdit={onEdit}
        onDelete={onDelete}
      />

      {selectedNode ? (
        <CategoryDetail
          node={selectedNode}
          categories={categories}
          transactions={transactions}
          onAddChild={onAddChild}
          onEdit={onEdit}
          onDelete={onDelete}
          actionCallbacks={{
            onEditOccurrence,
            onEditSeries,
            onDeleteTransaction,
            onDeleteSeries,
            onMarkPaid,
            onSkipOccurrence,
            onToggleScheduleState,
          }}
        />
      ) : fallback}
    </>
  );
}
