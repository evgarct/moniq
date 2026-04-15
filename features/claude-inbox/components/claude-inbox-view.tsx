"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Bot, ChevronDown, ChevronUp, Check, X, AlertCircle } from "lucide-react";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import { Surface } from "@/components/surface";
import { PendingTransactionRow } from "@/components/pending-transaction-row";
import type { Category, Account } from "@/types/finance";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BatchItem {
  id: string;
  title: string;
  amount: number;
  occurred_at: string;
  kind: "income" | "expense";
  currency: string | null;
  note: string | null;
  suggested_category_name: string | null;
  status: "pending" | "approved" | "rejected";
  resolved_category_id: string | null;
  resolved_account_id: string | null;
  finance_transaction_id: string | null;
}

interface Batch {
  id: string;
  status: "pending" | "approved" | "rejected";
  source_description: string | null;
  submitted_by: string | null;
  created_at: string;
  mcp_batch_items: BatchItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Batch section
// ---------------------------------------------------------------------------

function BatchSection({
  batch: initialBatch,
  categories,
  accounts,
}: {
  batch: Batch;
  categories: Category[];
  accounts: Account[];
}) {
  const t = useTranslations("claudeInbox");
  const [batch, setBatch] = useState(initialBatch);
  const [expanded, setExpanded] = useState(true);
  const [approvingAll, setApprovingAll] = useState(false);
  const [savingItemId, setSavingItemId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pendingCount = batch.mcp_batch_items.filter((i) => i.status === "pending").length;

  function handleItemUpdate(itemId: string, updated: BatchItem) {
    setBatch((prev) => ({
      ...prev,
      mcp_batch_items: prev.mcp_batch_items.map((i) => (i.id === itemId ? updated : i)),
    }));
  }

  async function patchItem(itemId: string, patch: Partial<BatchItem>) {
    setSavingItemId(itemId);
    try {
      const res = await fetch(`/api/mcp/batches/${batch.id}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) throw new Error();
      const updated: BatchItem = await res.json();
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
            const updated: BatchItem = await res.json();
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
    } catch {
      setError(t("feedback.rejectError"));
    }
  }

  const isFinalised = batch.status !== "pending";

  // Filter accounts to cash/credit only
  const accountOptions = accounts
    .filter((a) => a.type === "cash" || a.type === "credit_card")
    .map((a) => ({ id: a.id, name: a.name }));

  return (
    <Surface tone="panel" padding="none">
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-4">
        <Bot className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <div className="flex-1 min-w-0">
          <p className="type-body-14 font-medium text-foreground truncate">
            {batch.source_description ?? t("batch.defaultTitle")}
          </p>
          <p className="type-body-12 text-muted-foreground">
            {t("batch.submitted")} {formatDate(batch.created_at)}
            {" · "}
            {t("batch.items", { count: batch.mcp_batch_items.length })}
          </p>
        </div>

        {/* Batch status / actions */}
        {isFinalised ? (
          <span
            className={cn(
              "type-body-12 font-medium",
              batch.status === "approved"
                ? "text-emerald-600 dark:text-emerald-500"
                : "text-destructive",
            )}
          >
            {batch.status === "approved" ? t("batch.approved") : t("batch.rejected")}
          </span>
        ) : (
          <div className="flex items-center gap-1.5">
            {pendingCount > 0 && (
              <Button size="sm" onClick={approveAll} disabled={approvingAll}>
                {approvingAll ? t("batch.approving") : t("batch.approveAll")}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={rejectBatch} aria-label={t("batch.reject")}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}

        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-control p-1 text-muted-foreground hover:text-foreground"
        >
          {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 border-t border-border bg-destructive/5 px-5 py-2.5 type-body-12 text-destructive">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {error}
        </div>
      )}

      {/* Items */}
      {expanded && (
        <div className="px-5 pb-4">
          {batch.mcp_batch_items.length === 0 ? (
            <p className="py-4 text-center type-body-14 text-muted-foreground">—</p>
          ) : (
            <div className="flex flex-col">
              {batch.mcp_batch_items.map((item) => {
                const isPending = item.status === "pending";
                const categoriesForKind = categories.filter((c) => c.type === item.kind);

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
                    onCategoryChange={(id) =>
                      void patchItem(item.id, { resolved_category_id: id })
                    }
                    accounts={accountOptions}
                    resolvedAccountId={item.resolved_account_id}
                    onAccountChange={(id) =>
                      void patchItem(item.id, { resolved_account_id: id })
                    }
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
                            className="rounded-control p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-emerald-700 disabled:opacity-50"
                            aria-label={t("item.approve")}
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void patchItem(item.id, { status: "rejected" })}
                            disabled={savingItemId === item.id}
                            className="rounded-control p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive disabled:opacity-50"
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

// ---------------------------------------------------------------------------
// Root view
// ---------------------------------------------------------------------------

export function ClaudeInboxView({
  batches,
  categories,
  accounts,
}: {
  batches: Batch[];
  categories: Category[];
  accounts: Account[];
}) {
  const t = useTranslations("claudeInbox");

  if (batches.length === 0) {
    return (
      <EmptyState
        title={t("empty.title")}
        description={t("empty.description")}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {batches.map((batch) => (
        <BatchSection
          key={batch.id}
          batch={batch}
          categories={categories}
          accounts={accounts}
        />
      ))}
    </div>
  );
}
