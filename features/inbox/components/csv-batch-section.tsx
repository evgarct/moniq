"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileUp, ChevronDown, ChevronUp, Trash2, Check, X, AlertCircle, PencilLine } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DetailField, DetailFieldGrid } from "@/components/detail-field";
import { Surface } from "@/components/surface";
import { PendingTransactionRow } from "@/components/pending-transaction-row";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useBankingActions } from "@/features/banking/hooks/use-banking-actions";
import type { Category, Account } from "@/types/finance";
import type { TransactionImport, TransactionImportBatch } from "@/types/imports";

// ---------------------------------------------------------------------------
// Edit sheet (merchant name)
// ---------------------------------------------------------------------------

export function CsvEditSheet({
  transaction,
  open,
  onOpenChange,
  onSave,
}: {
  transaction: TransactionImport | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (merchant_clean: string) => void;
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
            <DetailFieldGrid>
              <DetailField label={t("review.fields.date")}>
                {new Date(transaction.occurred_at).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })}
              </DetailField>
              <DetailField label={t("review.fields.amount")}>
                {fmt(transaction.amount, transaction.currency)}
              </DetailField>
            </DetailFieldGrid>
            {transaction.wallet && (
              <DetailField label={t("review.fields.wallet")}>
                {transaction.wallet.name} · {transaction.wallet.currency}
              </DetailField>
            )}
            <Field>
              <FieldLabel htmlFor="csv-import-merchant">{t("review.fields.merchant")}</FieldLabel>
              <Input
                id="csv-import-merchant"
                key={transaction.id}
                defaultValue={transaction.merchant_clean}
                className="h-9 bg-background"
                onChange={(e) => setDraft(e.target.value)}
              />
            </Field>
            <DetailField label={t("review.fields.rawMerchant")} contentClassName="text-muted-foreground">
              {transaction.merchant_raw || "—"}
            </DetailField>
            <div className="mt-auto flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>{commonT("cancel")}</Button>
              <Button
                onClick={() => {
                  const next = draft.trim();
                  if (next && next !== transaction.merchant_clean) onSave(next);
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
  const bankingActions = useBankingActions();

  const [expanded, setExpanded] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      <Surface tone="panel" padding="none" className="flex h-full min-h-0 flex-col overflow-hidden">
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
              className="text-xs"
              onClick={() => {
                setError(null);
                bankingActions.confirmTransactions(
                  transactions.map((transaction) => transaction.id),
                  {
                    errorMessage: t("feedback.confirmFailed"),
                    onError: () => setError(t("feedback.confirmFailed")),
                    onSuccess: onFinalized,
                  },
                );
              }}
            >
              {t("inbox.confirmAll")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              aria-label={t("upload.deleteBatch")}
              onClick={() => {
                setError(null);
                bankingActions.deleteBatch(batch.id, {
                  errorMessage: t("feedback.deleteFailed"),
                  onError: () => setError(t("feedback.deleteFailed")),
                  onSuccess: onFinalized,
                });
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>

          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 text-muted-foreground"
            aria-label={t(expanded ? "inbox.collapse" : "inbox.expand")}
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
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
                    onCategoryChange={(id) => {
                      setError(null);
                      bankingActions.updateTransaction(tx.id, { category_id: id }, {
                        errorMessage: t("feedback.updateFailed"),
                        onError: () => setError(t("feedback.updateFailed")),
                      });
                    }}
                    accounts={walletOptions.map((w) => ({ id: w.id, name: w.name }))}
                    resolvedAccountId={tx.counterpart_wallet_id ?? null}
                    onAccountChange={(id) => {
                      setError(null);
                      bankingActions.updateTransaction(tx.id, { counterpart_wallet_id: id }, {
                        errorMessage: t("feedback.updateFailed"),
                        onError: () => setError(t("feedback.updateFailed")),
                      });
                    }}
                    status="pending"
                    selectCategoryPlaceholder={t("approval.selectCategory")}
                    noAccountPlaceholder={isTransfer ? t("approval.selectCounterpart") : undefined}
                    clearCategoryLabel={t("inbox.selectCategory")}
                    actions={
                      <>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => setEditingId(tx.id)}
                          className="text-muted-foreground"
                          aria-label={t("inbox.merchantLabel")}
                        >
                          <PencilLine className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setError(null);
                            bankingActions.confirmTransactions([tx.id], {
                              errorMessage: t("feedback.confirmFailed"),
                              onError: () => setError(t("feedback.confirmFailed")),
                              onSuccess: onFinalized,
                            });
                          }}
                          className="text-muted-foreground hover:text-emerald-700"
                          aria-label={t("inbox.confirmOne")}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => {
                            setError(null);
                            bankingActions.deleteTransaction(tx.id, {
                              errorMessage: t("feedback.deleteTransactionFailed"),
                              onError: () => setError(t("feedback.deleteTransactionFailed")),
                            });
                          }}
                          className="text-muted-foreground hover:text-destructive"
                          aria-label={t("inbox.deleteOne")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </>
                    }
                  />
                );
              })}
            </div>
          </div>
        )}
      </Surface>

      {/* Edit merchant sheet */}
      <CsvEditSheet
        transaction={editingTx}
        open={editingId !== null}
        onOpenChange={(open) => { if (!open) setEditingId(null); }}
        onSave={(merchant_clean) => {
          if (!editingId) return;
          setError(null);
          bankingActions.updateTransaction(editingId, { merchant_clean }, {
            errorMessage: t("feedback.updateFailed"),
            onError: () => setError(t("feedback.updateFailed")),
          });
        }}
      />
    </>
  );
}
