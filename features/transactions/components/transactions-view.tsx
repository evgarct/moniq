"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { SectionCard } from "@/components/section-card";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { CategoryDeleteSheet } from "@/features/categories/components/category-delete-sheet";
import { CategoryFormSheet } from "@/features/categories/components/category-form-sheet";
import { CategoryTree } from "@/features/categories/components/category-tree";
import { buildCategoryTree, flattenCategoryTree } from "@/features/categories/lib/category-tree";
import {
  createCategoryRequest,
  createTransactionRequest,
  deleteCategoryRequest,
  deleteTransactionRequest,
  financeSnapshotQueryKey,
  updateCategoryRequest,
  updateTransactionRequest,
} from "@/features/finance/lib/finance-api";
import { TransactionFormSheet } from "@/features/transactions/components/transaction-form-sheet";
import type { Category, FinanceSnapshot, Transaction } from "@/types/finance";
import type { CategoryInput, TransactionInput } from "@/types/finance-schemas";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import { useRouter } from "@/i18n/navigation";

export function TransactionsView() {
  const tr = useTranslations();
  const t = useTranslations("transactions");
  const categoriesT = useTranslations("categories.view");
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data } = useFinanceData();
  const snapshot = data ?? { accounts: [], allocations: [], categories: [], transactions: [] };
  const [actionError, setActionError] = useState<string | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [categorySheetMode, setCategorySheetMode] = useState<"add" | "edit">("add");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [transactionSheetOpen, setTransactionSheetOpen] = useState(false);
  const [transactionSheetMode, setTransactionSheetMode] = useState<"add" | "edit">("add");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<Category | null>(null);

  const setSnapshot = (nextSnapshot: FinanceSnapshot) => {
    queryClient.setQueryData(financeSnapshotQueryKey, nextSnapshot);
  };

  const categoryMutation = useMutation({
    mutationFn: async ({ mode, categoryId, values }: { mode: "add" | "edit"; categoryId?: string; values: CategoryInput }) =>
      mode === "add" ? createCategoryRequest(values) : updateCategoryRequest(categoryId!, values),
    onSuccess: (nextSnapshot) => {
      setSnapshot(nextSnapshot);
      setActionError(null);
    },
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: async ({ categoryId, replacementCategoryId }: { categoryId: string; replacementCategoryId: string | null }) =>
      deleteCategoryRequest(categoryId, replacementCategoryId),
    onSuccess: (nextSnapshot) => {
      setSnapshot(nextSnapshot);
      setActionError(null);
    },
  });

  const transactionMutation = useMutation({
    mutationFn: async ({ mode, transactionId, values }: { mode: "add" | "edit"; transactionId?: string; values: TransactionInput }) =>
      mode === "add" ? createTransactionRequest(values) : updateTransactionRequest(transactionId!, values),
    onSuccess: (nextSnapshot) => {
      setSnapshot(nextSnapshot);
      setActionError(null);
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: deleteTransactionRequest,
    onSuccess: (nextSnapshot) => {
      setSnapshot(nextSnapshot);
      setActionError(null);
    },
  });

  const categoryTree = useMemo(() => buildCategoryTree(snapshot.categories, snapshot.transactions), [snapshot.categories, snapshot.transactions]);
  const flatCategoryTree = useMemo(() => flattenCategoryTree(categoryTree), [categoryTree]);
  const replacementOptions = deletingCategory
    ? snapshot.categories.filter((category) => category.type === deletingCategory.type && category.id !== deletingCategory.id)
    : [];
  const deletingTransactionCount = deletingCategory
    ? snapshot.transactions.filter((transaction) => transaction.category_id === deletingCategory.id).length
    : 0;
  const transactionKindFromSearch = searchParams.get("kind");
  const shouldOpenNewTransaction = searchParams.get("new") === "1";
  const draftTransactionKind: Transaction["kind"] =
    transactionKindFromSearch === "income" ||
    transactionKindFromSearch === "expense" ||
    transactionKindFromSearch === "transfer" ||
    transactionKindFromSearch === "save_to_goal" ||
    transactionKindFromSearch === "spend_from_goal" ||
    transactionKindFromSearch === "debt_payment"
      ? transactionKindFromSearch
      : "expense";

  if (!snapshot.accounts.length) {
    return (
      <EmptyState
        title={t("view.emptyAccountsTitle")}
        description={t("view.emptyAccountsDescription")}
      />
    );
  }

  return (
    <>
      <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <SectionCard
          title={categoriesT("title")}
          description={categoriesT("description")}
          action={
            <Button
              onClick={() => {
                setCategorySheetMode("add");
                setEditingCategory(null);
                setCategorySheetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {categoriesT("add")}
            </Button>
          }
        >
          {actionError ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</div> : null}
          {categoryTree.length ? (
            <CategoryTree
              nodes={categoryTree}
              onAddChild={(node) => {
                setCategorySheetMode("add");
                setEditingCategory({
                  id: "",
                  user_id: "",
                  name: "",
                  icon: node.icon,
                  type: node.type,
                  parent_id: node.id,
                  created_at: new Date().toISOString(),
                });
                setCategorySheetOpen(true);
              }}
              onEdit={(node) => {
                setCategorySheetMode("edit");
                setEditingCategory(node);
                setCategorySheetOpen(true);
              }}
              onDelete={(node) => setDeletingCategory(node)}
            />
          ) : (
            <EmptyState title={categoriesT("emptyTitle")} description={categoriesT("emptyDescription")} />
          )}
        </SectionCard>

        <SectionCard
          title={t("view.title")}
          description={t("view.description")}
          action={
            <Button
              onClick={() => {
                setTransactionSheetMode("add");
                setEditingTransaction(null);
                setTransactionSheetOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              {t("view.add")}
            </Button>
          }
        >
          <TransactionList
            transactions={snapshot.transactions}
            emptyMessage={tr("common.empty.noTransactionsYet")}
            renderAction={(transaction) => (
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setTransactionSheetMode("edit");
                    setEditingTransaction(transaction);
                    setTransactionSheetOpen(true);
                  }}
                >
                  {t("view.edit")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      await deleteTransactionMutation.mutateAsync(transaction.id);
                    } catch (error) {
                      setActionError(error instanceof Error ? error.message : t("view.deleteError"));
                    }
                  }}
                >
                  {t("view.delete")}
                </Button>
              </div>
            )}
          />
        </SectionCard>
      </div>

      <CategoryFormSheet
        open={categorySheetOpen}
        mode={categorySheetMode}
        category={editingCategory}
        categories={snapshot.categories}
        onOpenChange={setCategorySheetOpen}
        onSubmit={async (values) => {
          try {
            await categoryMutation.mutateAsync({
              mode: categorySheetMode,
              categoryId: editingCategory?.id || undefined,
              values,
            });
          } catch (error) {
            setActionError(error instanceof Error ? error.message : categoriesT("saveError"));
            throw error;
          }
        }}
      />

      <CategoryDeleteSheet
        key={deletingCategory?.id ?? "category-delete"}
        open={Boolean(deletingCategory)}
        category={deletingCategory}
        replacementOptions={replacementOptions}
        transactionCount={deletingTransactionCount}
        onOpenChange={(open) => {
          if (!open) {
            setDeletingCategory(null);
          }
        }}
        onSubmit={async (replacementCategoryId) => {
          if (!deletingCategory) {
            return;
          }

          try {
            await deleteCategoryMutation.mutateAsync({
              categoryId: deletingCategory.id,
              replacementCategoryId,
            });
            setDeletingCategory(null);
          } catch (error) {
            setActionError(error instanceof Error ? error.message : categoriesT("deleteError"));
            throw error;
          }
        }}
      />

      <TransactionFormSheet
        open={transactionSheetOpen || shouldOpenNewTransaction}
        mode={transactionSheetMode}
        transaction={editingTransaction}
        initialKind={draftTransactionKind}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={flatCategoryTree}
        onOpenChange={(open) => {
          setTransactionSheetOpen(open);

          if (!open && shouldOpenNewTransaction) {
            router.replace("/transactions");
          }
        }}
        onSubmit={async (values) => {
          try {
            await transactionMutation.mutateAsync({
              mode: transactionSheetMode,
              transactionId: editingTransaction?.id || undefined,
              values,
            });
          } catch (error) {
            setActionError(error instanceof Error ? error.message : t("view.saveError"));
            throw error;
          }

          if (shouldOpenNewTransaction) {
            router.replace("/transactions");
          }
        }}
      />
    </>
  );
}
