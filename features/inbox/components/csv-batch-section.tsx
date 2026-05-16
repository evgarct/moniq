"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileUp, ChevronDown, ChevronUp, Trash2, Check, X, AlertCircle, PencilLine } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import { Surface } from "@/components/surface";
import { PendingTransactionRow } from "@/components/pending-transaction-row";
import { ViewportScrollRegion } from "@/features/inbox/components/viewport-scroll-region";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  bankingSnapshotQueryKey,
  batchConfirmImportedTransactionsRequest,
  deleteImportedTransactionRequest,
  deleteImportBatchRequest,
  updateImportedTransactionRequest,
} from "@/features/banking/lib/banking-api";
import type { Category, Account } from "@/types/finance";
import type { TransactionImport, TransactionImportBatch } from "@/types/imports";

// ---------------------------------------------------------------------------
// Edit sheet (merchant name)
// ---------------------------------------------------------------------------

function EditSheet({
  transaction,
  open,
  onOpenChange,
  onSave,
}: {
  transaction: TransactionImport | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (merchant_clean: string) => Promise<void>;
}) {
  const t = useTranslations("imports");
  const commonT = useTranslations("common.actions");
  const [draft, setDraft] = useState(transaction?.merchant_clean ?? "");

  const fmt = (val: number, cur: string) =>
    new Intl.NumberFormat(undefined, { style: "currency", currency: cur, maximumFractionDigits: 2 }).format(val);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-border/70 pb-4 pr-12">
          <SheetTitle>{t("review.title")}</SheetTitle>
          <SheetDescription>{t("review.description")}</SheetDescription>
        </SheetHeader>
        {transaction && (
          <div key={transaction.id} className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{t("review.fields.date")}</div>
                <div className="text-sm">{new Date(transaction.occurred_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{t("review.fields.amount")}</div>
                <div className="text-sm">{fmt(transaction.amount, transaction.currency)}</div>
              </div>
            </div>
            {transaction.wallet && (
              <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{t("review.fields.wallet")}</div>
                <div className="text-sm">{transaction.wallet.name} · {transaction.wallet.currency}</div>
              </div>
            )}
            <Field>
              <FieldLabel>{t("review.fields.merchant")}</FieldLabel>
              <Input
                key={transaction.id}
                defaultValue={transaction.merchant_clean}
                className="h-9 bg-background"
                onChange={(e) => setDraft(e.target.value)}
              />
            </Field>
            <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{t("review.fields.rawMerchant")}</div>
              <div className="text-sm text-muted-foreground">{transaction.merchant_raw || "—"}</div>
            </div>
            <div className="mt-auto flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>{commonT("cancel")}</Button>
              <Button
                onClick={async () => {
                  const next = draft.trim();
                  if (next && next !== transaction.merchant_clean) await onSave(next);
                  onOpenChange(false);
                }}
              >
                {commonT("save")}
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// CSV Batch section
// ---------------------------------------------------------------------------

export function CsvBatchSection({
  batch,
  transactions,
  categories,
  wallets,
  onFinalized,
}: {
  batch: TransactionImportBatch;
  transactions: TransactionImport[];
  categories: Category[];
  wallets: Account[];
  onFinalized?: () => void;
}) {
  const t = useTranslations("imports");
  const qc = useQueryClient();

  const [expanded, setExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const invalidateSnapshot = () => void qc.invalidateQueries({ queryKey: bankingSnapshotQueryKey });

  const updateMutation = useMutation({
    mutationFn: ({ id, values }: { id: string; values: Parameters<typeof updateImportedTransactionRequest>[1] }) =>
      updateImportedTransactionRequest(id, values),
    onSuccess: () => { invalidateSnapshot(); setError(null); },
    onError: () => setError(t("feedback.updateFailed")),
  });

  const confirmMutation = useMutation({
    mutationFn: batchConfirmImportedTransactionsRequest,
    onSuccess: () => { invalidateSnapshot(); setError(null); onFinalized?.(); },
    onError: () => setError(t("feedback.confirmFailed")),
  });

  const deleteTxMutation = useMutation({
    mutationFn: deleteImportedTransactionRequest,
    onSuccess: () => { invalidateSnapshot(); setError(null); },
    onError: () => setError(t("feedback.deleteTransactionFailed")),
  });

  const deleteBatchMutation = useMutation({
    mutationFn: deleteImportBatchRequest,
    onSuccess: () => { invalidateSnapshot(); setError(null); onFinalized?.(); },
    onError: () => setError(t("feedback.deleteFailed")),
  });

  const walletOptions = wallets.filter((w) => w.type !== "debt");

  const editingTx = editingId ? transactions.find((tx) => tx.id === editingId) ?? null : null;

  // Earliest – latest date label
  const dates = transactions.map((tx) => tx.occurred_at).sort();
  const dateLabel = dates.length > 0
    ? dates[0].slice(0, 10) === dates[dates.length - 1].slice(0, 10)
      ? new Date(dates[0]).toLocaleDateString(undefined, { month: "short", day: "numeric" })
      : `${new Date(dates[0]).toLocaleDateString(undefined, { month: "short", day: "numeric" })} – ${new Date(dates[dates.length - 1]).toLocaleDateString(undefined, { month: "short", day: "numeric" })}`
    : null;

  if (transactions.length === 0) return null;

  return (
    <>
      <ViewportScrollRegion overflow={false} className="overflow-hidden">
        <Surface tone="panel" padding="none" className="flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3.5 sm:px-5 sm:py-4">
          <FileUp className="h-[18px] w-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
          <div className="flex-1 min-w-0">
            <p className="type-body-14 font-medium text-foreground truncate">
              {batch.file_name}
            </p>
            <p className="type-body-12 text-muted-foreground">
              {batch.wallet?.name && <>{batch.wallet.name} · </>}
              {dateLabel && <>{dateLabel} · </>}
              {t("inbox.count", { count: transactions.length })}
            </p>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              size="sm"
              className="h-8 text-xs"
              disabled={confirmMutation.isPending}
              onClick={() => void confirmMutation.mutateAsync(transactions.map((tx) => tx.id))}
            >
              {confirmMutation.isPending ? "…" : t("inbox.confirmAll")}
            </Button>
            <button
              type="button"
              className="flex size-10 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive disabled:opacity-50"
              disabled={deleteBatchMutation.isPending}
              aria-label={t("upload.deleteBatch")}
              onClick={() => void deleteBatchMutation.mutateAsync(batch.id)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>

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
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 sm:px-5">
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pr-1 -mr-1">
              {transactions.map((tx) => {
                const categoriesForKind = categories.filter((c) => c.type === tx.kind);
                const isTransfer = tx.kind === "transfer" || tx.kind === "debt_payment";

                return (
                  <PendingTransactionRow
                    key={tx.id}
                    title={tx.merchant_clean}
                    amount={tx.amount}
                    currency={tx.currency}
                    kind={tx.kind === "income" ? "income" : "expense"}
                    occurredAt={tx.occurred_at}
                    categories={isTransfer ? [] : categoriesForKind}
                    resolvedCategoryId={tx.category_id}
                    onCategoryChange={(id) =>
                      void updateMutation.mutateAsync({ id: tx.id, values: { category_id: id } })
                    }
                    accounts={walletOptions.map((w) => ({ id: w.id, name: w.name }))}
                    resolvedAccountId={tx.counterpart_wallet_id ?? null}
                    onAccountChange={(id) =>
                      void updateMutation.mutateAsync({ id: tx.id, values: { counterpart_wallet_id: id } })
                    }
                    status="pending"
                    saving={updateMutation.isPending}
                    selectCategoryPlaceholder={t("approval.selectCategory")}
                    noAccountPlaceholder={isTransfer ? t("approval.selectCounterpart") : undefined}
                    clearCategoryLabel={t("inbox.selectCategory")}
                    actions={
                      <>
                        <button
                          type="button"
                          onClick={() => setEditingId(tx.id)}
                          className="flex size-10 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                          aria-label={t("inbox.merchantLabel")}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={confirmMutation.isPending}
                          onClick={() => void confirmMutation.mutateAsync([tx.id])}
                          className="flex size-10 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-secondary hover:text-emerald-700 disabled:opacity-50"
                          aria-label={t("inbox.confirmOne")}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={deleteTxMutation.isPending}
                          onClick={() => void deleteTxMutation.mutateAsync(tx.id)}
                          className="flex size-10 items-center justify-center rounded-control text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive disabled:opacity-50"
                          aria-label={t("inbox.deleteOne")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </>
                    }
                  />
                );
              })}
            </div>
          </div>
        )}
        </Surface>
      </ViewportScrollRegion>

      {/* Edit merchant sheet */}
      <EditSheet
        transaction={editingTx}
        open={editingId !== null}
        onOpenChange={(open) => { if (!open) setEditingId(null); }}
        onSave={async (merchant_clean) => {
          if (!editingId) return;
          await updateMutation.mutateAsync({ id: editingId, values: { merchant_clean } });
        }}
      />
    </>
  );
}
