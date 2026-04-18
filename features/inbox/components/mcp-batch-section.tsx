"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, ChevronDown, ChevronUp, Check, X, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/surface";
import { PendingTransactionRow } from "@/components/pending-transaction-row";
import { cn } from "@/lib/utils";
import type { Category, Account, TransactionKind } from "@/types/finance";
import type { McpBatch, McpBatchItem } from "@/features/inbox/hooks/use-mcp-batches";

const ALL_KINDS: TransactionKind[] = [
  "expense", "income", "transfer", "save_to_goal", "spend_from_goal",
  "debt_payment", "investment", "refund", "adjustment",
];

function categoryTypeForKind(kind: TransactionKind): "income" | "expense" | null {
  if (kind === "income") return "income";
  if (kind === "expense" || kind === "investment" || kind === "refund" || kind === "debt_payment") return "expense";
  return null;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function McpBatchSection({
  batch: initialBatch,
  categories,
  accounts,
  onFinalized,
}: {
  batch: McpBatch;
  categories: Category[];
  accounts: Account[];
  onFinalized?: () => void;
}) {
  const t = useTranslations("claudeInbox");
  const tKinds = useTranslations("transactions.kinds");

  const kindOptions = ALL_KINDS.map((k) => ({ value: k, label: tKinds(k) }));
  const [batch, setBatch] = useState(initialBatch);
  const [expanded, setExpanded] = useState(true);
  const [approvingAll, setApprovingAll] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = batch.mcp_batch_items.filter((i) => i.status === "pending").length;

  function handleItemUpdate(itemId: string, updated: McpBatchItem) {
    setBatch((prev) => ({
      ...prev,
      mcp_batch_items: prev.mcp_batch_items.map((i) => (i.id === itemId ? updated : i)),
    }));
  }

  async function patchItem(itemId: string, patch: Partial<McpBatchItem>) {
    setSavingItemId(itemId);
    try {
      const res = await fetch(`/api/mcp/batches/${batch.id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const updated: McpBatchItem = await res.json();
      handleItemUpdate(itemId, updated);
    } finally {
      setSavingItemId(null);
    }
  }

  async function approveAll() {
    setApprovingAll(true);
    setError(null);
    try {
      const pending = batch.mcp_batch_items.filter((i) => i.status === "pending");
      await Promise.all(
        pending.map(async (item) => {
          const res = await fetch(`/api/mcp/batches/${batch.id}/items/${item.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "approved" }),
          });
          if (res.ok) {
            const updated: McpBatchItem = await res.json();
            handleItemUpdate(item.id, updated);
          }
        }),
      );
      const res = await fetch(`/api/mcp/batches/${batch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "approve" }),
      });
      if (!res.ok) throw new Error();
      setBatch((prev) => ({ ...prev, status: "approved" }));
      onFinalized?.();
    } catch {
      setError(t("feedback.approveError"));
    } finally {
      setApprovingAll(false);
    }
  }

  async function rejectBatch() {
    try {
      const res = await fetch(`/api/mcp/batches/${batch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reject" }),
      });
      if (!res.ok) throw new Error();
      setBatch((prev) => ({ ...prev, status: "rejected" }));
      onFinalized?.();
    } catch {
      setError(t("feedback.rejectError"));
    }
  }

  const isFinalised = batch.status !== "pending";
  const accountOptions = accounts
    .filter((a) => a.type === "cash" || a.type === "credit_card")
    .map((a) => ({ id: a.id, name: a.name }));

  return (
    <Surface tone="panel" padding="none">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 dark:bg-violet-900/40">
          <Bot className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="type-body-14 font-medium text-foreground truncate">
            {batch.source_description ?? t("batch.defaultTitle")}
          </p>
          <p className="type-body-12 text-muted-foreground">
            {formatDate(batch.created_at)}
            {" · "}
            {t("batch.items", { count: batch.mcp_batch_items.length })}
          </p>
        </div>

        {!isFinalised && (
          <div className="flex items-center gap-1 shrink-0">
            {pendingCount > 0 && (
              <Button size="sm" onClick={approveAll} disabled={approvingAll} className="h-8 text-xs">
                {approvingAll ? t("batch.approving") : t("batch.approveAll")}
              </Button>
            )}
            <button
              type="button"
              onClick={rejectBatch}
              className="flex h-8 w-8 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
              aria-label={t("batch.reject")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-control p-1 text-muted-foreground hover:text-foreground shrink-0"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 border-t border-border bg-destructive/5 px-4 py-2.5 text-xs text-destructive sm:px-5">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Items */}
      {expanded && (
        <div className="px-4 pb-4 sm:px-5">
          {batch.mcp_batch_items.length === 0 ? (
            <p className="py-4 text-center type-body-14 text-muted-foreground">—</p>
          ) : (
            <div className="flex flex-col">
              {batch.mcp_batch_items.map((item) => {
                const isPending = item.status === "pending";
                const catType = categoryTypeForKind(item.kind);
                const categoriesForKind = catType ? categories.filter((c) => c.type === catType) : [];

                return (
                  <PendingTransactionRow
                    key={item.id}
                    title={item.title}
                    amount={item.amount}
                    currency={item.currency}
                    kind={item.kind}
                    occurredAt={item.occurred_at}
                    categories={categoriesForKind}
                    resolvedCategoryId={item.resolved_category_id}
                    suggestedCategoryName={item.suggested_category_name}
                    onCategoryChange={(id) => void patchItem(item.id, { resolved_category_id: id })}
                    kindOptions={kindOptions}
                    onKindChange={(kind) => void patchItem(item.id, { kind: kind as TransactionKind, resolved_category_id: null })}
                    accounts={accountOptions}
                    resolvedAccountId={item.resolved_account_id}
                    onAccountChange={(id) => void patchItem(item.id, { resolved_account_id: id })}
                    status={item.status}
                    statusLabel={
                      item.status === "approved"
                        ? t("item.approved")
                        : item.status === "rejected"
                          ? t("item.rejected")
                          : undefined
                    }
                    saving={savingItemId === item.id}
                    selectCategoryPlaceholder={t("item.uncategorized")}
                    noAccountPlaceholder={t("item.noAccount")}
                    clearCategoryLabel={t("item.uncategorized")}
                    actions={
                      isPending ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void patchItem(item.id, { status: "approved" })}
                            disabled={savingItemId === item.id}
                            className="flex h-8 w-8 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-secondary hover:text-emerald-700 disabled:opacity-50"
                            aria-label={t("item.approve")}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void patchItem(item.id, { status: "rejected" })}
                            disabled={savingItemId === item.id}
                            className="flex h-8 w-8 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive disabled:opacity-50"
                            aria-label={t("item.reject")}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : undefined
                    }
                  />
                );
              })}
            </div>
          )}
        </div>
      )}
    </Surface>
  );
}
