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
  deleteCategoryRequest,
  financeSnapshotQueryKey,
  updateCategoryRequest,
} from "@/features/finance/lib/finance-api";
import { TransactionFormSheet, type TransactionFormSubmitPayload } from "@/features/transactions/components/transaction-form-sheet";
import { useTransactionActions } from "@/features/transactions/hooks/use-transaction-actions";
import type { Category, FinanceSnapshot, Transaction, TransactionSchedule } from "@/types/finance";
import type { CategoryInput } from "@/types/finance-schemas";
import { useFinanceData } from "@/features/finance/hooks/use-finance-data";
import { useRouter } from "@/i18n/navigation";

const emptySnapshot: FinanceSnapshot = {
  accounts: [],
  allocations: [],
  categories: [],
  schedules: [],
  transactions: [],
};

export function TransactionsView({
  snapshot: snapshotProp,
  basePath = "/transactions",
}: {
  snapshot?: FinanceSnapshot;
  basePath?: "/transactions" | "/budget";
}) {
  const tr = useTranslations();
  const t = useTranslations("transactions");
  const categoriesT = useTranslations("categories.view");
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data } = useFinanceData();
  const snapshot = snapshotProp ?? data ?? emptySnapshot;
  const transactionActions = useTransactionActions();
  const [actionError, setActionError] = useState<string | null>(null);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [categorySheetMode, setCategorySheetMode] = useState<"add" | "edit">("add");
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [transactionSheetOpen, setTransactionSheetOpen] = useState(false);
  const [transactionSheetMode, setTransactionSheetMode] = useState<"add" | "edit-transaction" | "edit-schedule">("add");
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [editingSchedule, setEditingSchedule] = useState<TransactionSchedule | null>(null);
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
                setEditingSchedule(null);
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
            onEditOccurrence={(selectedTransaction) => {
              setTransactionSheetMode("edit-transaction");
              setEditingTransaction(selectedTransaction);
              setEditingSchedule(null);
              setTransactionSheetOpen(true);
            }}
            onEditSeries={(selectedTransaction) => {
              if (!selectedTransaction.schedule) return;
              setTransactionSheetMode("edit-schedule");
              setEditingTransaction(selectedTransaction);
              setEditingSchedule(selectedTransaction.schedule);
              setTransactionSheetOpen(true);
            }}
            onDeleteTransaction={(selectedTransaction) => {
              transactionActions.deleteTransactionOptimistic(selectedTransaction.id);
            }}
            onDeleteSeries={async (selectedTransaction) => {
              if (!selectedTransaction.schedule_id) return;
              try {
                await transactionActions.deleteSchedule(selectedTransaction.schedule_id);
                setActionError(null);
              } catch (error) {
                setActionError(error instanceof Error ? error.message : t("view.deleteError"));
              }
            }}
            onMarkPaid={(selectedTransaction) => {
              transactionActions.markPaidOptimistic(selectedTransaction.id);
            }}
            onSkipOccurrence={(selectedTransaction) => {
              transactionActions.skipOccurrenceOptimistic(selectedTransaction.id);
            }}
            onToggleScheduleState={async (selectedTransaction) => {
              if (!selectedTransaction.schedule_id || !selectedTransaction.schedule) return;
              try {
                await transactionActions.setScheduleState(
                  selectedTransaction.schedule_id,
                  selectedTransaction.schedule.state === "paused" ? "active" : "paused",
                );
                setActionError(null);
              } catch (error) {
                setActionError(error instanceof Error ? error.message : t("view.saveError"));
              }
            }}
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
        schedule={editingSchedule}
        initialKind={draftTransactionKind}
        accounts={snapshot.accounts}
        allocations={snapshot.allocations}
        categories={flatCategoryTree}
        transactions={snapshot.transactions}
        onOpenChange={(open) => {
          setTransactionSheetOpen(open);

          if (!open && shouldOpenNewTransaction) {
            router.replace(basePath);
          }
        }}
        onSubmit={async (payload: TransactionFormSubmitPayload) => {
          try {
            if (payload.kind === "entry") {
              await transactionActions.createEntry(payload.values);
            } else if (payload.kind === "entry-batch") {
              await transactionActions.createEntry(payload.values);
            } else if (payload.kind === "transaction") {
              if (!editingTransaction) {
                throw new Error(t("view.saveError"));
              }

              await transactionActions.updateTransaction(editingTransaction.id, payload.values);
              if (payload.rescheduleFrom) {
                await transactionActions.rescheduleFromDate(
                  payload.rescheduleFrom.scheduleId,
                  payload.rescheduleFrom.originalDate,
                  payload.rescheduleFrom.newDate,
                );
              }
            } else {
              if (!editingSchedule) {
                throw new Error(t("view.saveError"));
              }

              await transactionActions.updateSchedule(editingSchedule.id, payload.values);
            }
            setActionError(null);
          } catch (error) {
            setActionError(error instanceof Error ? error.message : t("view.saveError"));
            throw error;
          }

          if (shouldOpenNewTransaction) {
            router.replace(basePath);
          }
        }}
      />
    </>
  );
}
