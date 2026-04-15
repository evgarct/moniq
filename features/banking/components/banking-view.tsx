"use client";

import { parseISO } from "date-fns";
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Eye, EyeOff, FileUp, Info, PencilLine, SlidersHorizontal, Trash2 } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { PendingTransactionRow } from "@/components/pending-transaction-row";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  bankingSnapshotQueryKey,
  batchConfirmImportedTransactionsRequest,
  deleteImportedTransactionRequest,
  deleteImportBatchRequest,
  fetchImportPreviewRequest,
  updateImportedTransactionRequest,
  uploadMappedImportRequest,
} from "@/features/banking/lib/banking-api";
import { useBankingData } from "@/features/banking/hooks/use-banking-data";
import { cn } from "@/lib/utils";
import type { ImportColumnKey, ImportColumnMapping, ImportFilePreview, TransactionImport } from "@/types/imports";
import type { Category } from "@/types/finance";

const KIND_OPTIONS = ["expense", "income", "transfer", "debt_payment"] as const;
const BASIC_MAPPING_FIELDS: Array<{ key: ImportColumnKey; required?: boolean }> = [
  { key: "date", required: true },
  { key: "description", required: true },
  { key: "amount" },
];
const ADVANCED_MAPPING_FIELDS: Array<{ key: ImportColumnKey; required?: boolean }> = [
  { key: "debit" },
  { key: "credit" },
  { key: "currency" },
  { key: "type" },
  { key: "externalId" },
];


function canImportWithCurrentMapping(mapping: ImportColumnMapping) {
  return Boolean(mapping.date && mapping.description && (mapping.amount || mapping.debit || mapping.credit));
}

function isImportReadyForConfirmation(transaction: TransactionImport) {
  if (transaction.kind === "transfer" || transaction.kind === "debt_payment") {
    return Boolean(transaction.counterpart_wallet_id);
  }

  return Boolean(transaction.category_id);
}

function formatBatchDateRange(
  transactions: TransactionImport[],
  format: ReturnType<typeof useFormatter>,
) {
  if (!transactions.length) {
    return null;
  }

  const sortedDates = transactions
    .map((transaction) => parseISO(transaction.occurred_at).getTime())
    .sort((left, right) => left - right);
  const start = new Date(sortedDates[0]);
  const end = new Date(sortedDates[sortedDates.length - 1]);

  const startLabel = format.dateTime(start, { dateStyle: "medium" });
  const endLabel = format.dateTime(end, { dateStyle: "medium" });

  return startLabel === endLabel ? startLabel : `${startLabel} — ${endLabel}`;
}


function MappingField({
  field,
  mapping,
  preview,
  t,
  onChange,
}: {
  field: { key: ImportColumnKey; required?: boolean };
  mapping: ImportColumnMapping;
  preview: ImportFilePreview;
  t: ReturnType<typeof useTranslations<"imports">>;
  onChange: (key: ImportColumnKey, value: string | null) => void;
}) {
  const selectedColumnLabel =
    mapping[field.key] != null ? preview.columns.find((column) => column.key === mapping[field.key])?.label ?? null : null;

  return (
    <Field>
      <FieldLabel>
        {t(`mapping.fields.${field.key}`)}
        {field.required ? " *" : ""}
      </FieldLabel>
      <Select value={mapping[field.key] ?? "__none__"} onValueChange={(value) => onChange(field.key, value === "__none__" ? null : value)}>
      <SelectTrigger size="sm" className="w-full rounded-[10px] bg-background shadow-none">
        <SelectValue>{selectedColumnLabel ?? t("mapping.selectColumn")}</SelectValue>
      </SelectTrigger>
        <SelectContent>
          <SelectItem value="__none__">{t("mapping.none")}</SelectItem>
          <SelectGroup>
            {preview.columns.map((column) => (
              <SelectItem key={column.key} value={column.key}>
                {column.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </Field>
  );
}

function ImportDetailSheet({
  transaction,
  open,
  t,
  commonT,
  onOpenChange,
  onPatch,
}: {
  transaction: TransactionImport | null;
  open: boolean;
  t: ReturnType<typeof useTranslations<"imports">>;
  commonT: ReturnType<typeof useTranslations<"common.actions">>;
  onOpenChange: (open: boolean) => void;
  onPatch: (values: { merchant_clean?: string }) => Promise<void>;
}) {
  const [merchantDraft, setMerchantDraft] = useState(transaction?.merchant_clean ?? "");

  const currentMerchant = transaction?.merchant_clean ?? "";
  const amountLabel = transaction
    ? new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: transaction.currency,
        maximumFractionDigits: 2,
      }).format(transaction.amount)
    : "—";
  const dateLabel = transaction
    ? new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(parseISO(transaction.occurred_at))
    : "—";
  const walletLabel = transaction?.wallet ? `${transaction.wallet.name} · ${transaction.wallet.currency}` : "—";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader className="border-b border-border/70 pb-4 pr-12">
          <SheetTitle>{t("review.title")}</SheetTitle>
          <SheetDescription>{t("review.description")}</SheetDescription>
        </SheetHeader>

        {transaction ? (
          <div key={transaction.id} className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{t("review.fields.date")}</div>
                <div className="text-sm text-foreground">{dateLabel}</div>
              </div>
              <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
                <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{t("review.fields.amount")}</div>
                <div className="text-sm text-foreground">{amountLabel}</div>
              </div>
            </div>

            <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{t("review.fields.wallet")}</div>
              <div className="text-sm text-foreground">{walletLabel}</div>
            </div>

            <Field>
              <FieldLabel>{t("review.fields.merchant")}</FieldLabel>
              <Input
                key={transaction.id}
                defaultValue={currentMerchant}
                className="h-9 bg-background"
                onChange={(event) => setMerchantDraft(event.target.value)}
              />
            </Field>

            <div className="rounded-xl border border-border/70 bg-background px-3 py-2">
              <div className="text-[11px] uppercase tracking-[0.12em] text-muted-foreground">{t("review.fields.rawMerchant")}</div>
              <div className="text-sm text-foreground">{transaction.merchant_raw || "—"}</div>
            </div>

            <div className="mt-auto flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                {commonT("cancel")}
              </Button>
              <Button
                type="button"
                onClick={async () => {
                  const nextMerchant = merchantDraft.trim();
                  if (nextMerchant && nextMerchant !== currentMerchant) {
                    await onPatch({ merchant_clean: nextMerchant });
                  }
                  onOpenChange(false);
                }}
              >
                {commonT("save")}
              </Button>
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

export function BankingView() {
  const t = useTranslations("imports");
  const transactionsT = useTranslations("transactions");
  const commonT = useTranslations("common.actions");
  const format = useFormatter();
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useBankingData();
  const [editingImportId, setEditingImportId] = useState<string | null>(null);
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ImportFilePreview | null>(null);
  const [mapping, setMapping] = useState<ImportColumnMapping | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showAdvancedMapping, setShowAdvancedMapping] = useState(false);
  const [showPreviewRows, setShowPreviewRows] = useState(false);
  const actionButtonClassName =
    "rounded-md bg-transparent text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground active:bg-[#e6e1d9]";

  const setSnapshot = (snapshot: NonNullable<typeof data>) => {
    queryClient.setQueryData(bankingSnapshotQueryKey, snapshot);
  };

  const previewMutation = useMutation({
    mutationFn: fetchImportPreviewRequest,
    onSuccess: (nextPreview) => {
      setPreview(nextPreview);
      setMapping(nextPreview.suggestedMapping);
      setActionError(null);
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      const walletId = effectiveWalletId;
      if (!walletId) {
        throw new Error(t("upload.walletRequired"));
      }
      if (!selectedFile || !mapping) {
        throw new Error(t("upload.fileRequired"));
      }
      return uploadMappedImportRequest({
        walletId,
        file: selectedFile,
        mapping,
      });
    },
    onSuccess: (snapshot) => {
      setSnapshot(snapshot);
      setSelectedFile(null);
      setPreview(null);
      setMapping(null);
      setShowAdvancedMapping(false);
      setShowPreviewRows(false);
      setActionError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      transactionId,
      values,
    }: {
      transactionId: string;
      values: {
        merchant_clean?: string;
        category_id?: string | null;
        kind?: "expense" | "income" | "transfer" | "debt_payment";
        wallet_id?: string;
        counterpart_wallet_id?: string | null;
      };
    }) => updateImportedTransactionRequest(transactionId, values),
    onSuccess: (snapshot) => {
      setSnapshot(snapshot);
      setActionError(null);
    },
  });

  const confirmMutation = useMutation({
    mutationFn: batchConfirmImportedTransactionsRequest,
    onSuccess: (snapshot) => {
      setSnapshot(snapshot);
      setActionError(null);
    },
  });

  const deleteTransactionMutation = useMutation({
    mutationFn: deleteImportedTransactionRequest,
    onSuccess: (snapshot) => {
      setSnapshot(snapshot);
      setActionError(null);
    },
  });

  const deleteBatchMutation = useMutation({
    mutationFn: deleteImportBatchRequest,
    onSuccess: (snapshot) => {
      setSnapshot(snapshot);
      setActionError(null);
    },
  });

  async function handleFilePicked(file: File | null) {
    if (!file) {
      return;
    }

    setSelectedFile(file);
    setDragActive(false);
    setActionError(null);
    setShowAdvancedMapping(false);
    setShowPreviewRows(false);

    try {
      await previewMutation.mutateAsync(file);
    } catch (caughtError) {
      setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.uploadFailed"));
    }
  }

  if (isLoading) {
    return (
      <PageContainer>
        <EmptyState title={t("loading.title")} description={t("loading.description")} />
      </PageContainer>
    );
  }

  if (error || !data) {
    return (
      <PageContainer>
        <EmptyState title={t("error.title")} description={error instanceof Error ? error.message : t("error.description")} />
      </PageContainer>
    );
  }

  const walletOptions = data.wallets.filter((wallet) => wallet.type !== "debt");
  const debtWalletOptions = data.wallets.filter((wallet) => wallet.type === "debt");
  const effectiveWalletId = selectedWalletId || walletOptions[0]?.id || "";
  const categoryOptions = data.categories.filter((category) => category.type === "expense" || category.type === "income");
  const draftTransactions = data.draftTransactions;
  const batchStatus = new Map(
    data.batches.map((batch) => {
      const draftCount = data.draftTransactions.filter((transaction) => transaction.batch_id === batch.id).length;
      return [batch.id, { draftCount }];
    }),
  );
  const draftTransactionsByBatchId = new Map(
    data.batches.map((batch) => [
      batch.id,
      draftTransactions.filter((transaction) => transaction.batch_id === batch.id),
    ]),
  );
  const visibleDraftBatches = data.batches.filter((batch) => (batchStatus.get(batch.id)?.draftCount ?? 0) > 0);
  const selectedWallet = walletOptions.find((wallet) => wallet.id === effectiveWalletId);
  const selectedWalletName = selectedWallet ? `${selectedWallet.name} · ${selectedWallet.currency}` : t("upload.fields.walletPlaceholder");
  const draftTransactionsById = new Map(draftTransactions.map((transaction) => [transaction.id, transaction]));
  const editingImport = editingImportId ? draftTransactionsById.get(editingImportId) ?? null : null;

  // Group draft transactions by date for the review panel
  const draftByDate: { dateKey: string; dateLabel: string; transactions: typeof draftTransactions }[] = [];
  {
    const groups = new Map<string, typeof draftTransactions>();
    for (const tx of [...draftTransactions].sort(
      (a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime(),
    )) {
      const key = tx.occurred_at.slice(0, 10);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(tx);
    }
    for (const [key, txs] of groups) {
      draftByDate.push({
        dateKey: key,
        dateLabel: new Date(key).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }),
        transactions: txs,
      });
    }
  }

  return (
    <PageContainer className="h-full overflow-hidden px-0 py-0 sm:px-0">
      <div className="grid h-full w-full grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col overflow-auto border-b border-border/40 bg-card lg:overflow-hidden lg:border-r lg:border-b-0 lg:border-r-border/25">
          <div className="shrink-0 bg-card/96 backdrop-blur supports-[backdrop-filter]:bg-card/88">
            <div className="flex flex-col gap-4 px-3 pt-4 pb-3 sm:px-6 sm:pt-7 sm:pb-5 lg:px-7 lg:pt-8 lg:pb-6">
              <div className="flex items-start justify-between gap-3 px-1.5 sm:items-center sm:px-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <h1 className="min-w-0 truncate font-heading text-[28px] leading-none tracking-[-0.035em] text-foreground sm:type-h1">
                    {t("upload.title")}
                  </h1>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={actionButtonClassName}
                          aria-label={t("upload.description")}
                        />
                      }
                    >
                      <Info className="size-4 translate-y-[2px]" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-72 text-balance">
                      {t("upload.description")}
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex shrink-0 items-center gap-1 sm:gap-2" role="toolbar" aria-label={t("upload.title")} />
              </div>

              {actionError ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {actionError}
                </div>
              ) : null}

              <div className="space-y-4 px-1.5 sm:px-2.5">
                <div
                  className={cn(
                    "cursor-pointer rounded-lg border border-dashed px-4 py-6 text-center transition-colors",
                    dragActive ? "border-foreground/40 bg-[#f3efe9]" : "border-border/80 bg-background/70",
                  )}
                  onClick={() => document.getElementById("csv-file")?.click()}
                  onDragOver={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setDragActive(true);
                  }}
                  onDragLeave={(event) => {
                    event.preventDefault();
                    const nextTarget = event.relatedTarget;
                    if (nextTarget instanceof Node && event.currentTarget.contains(nextTarget)) {
                      return;
                    }
                    setDragActive(false);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    void handleFilePicked(event.dataTransfer.files?.[0] ?? null);
                  }}
                >
                  <div className="mx-auto flex max-w-[240px] flex-col items-center gap-2.5">
                    <div className="rounded-full border border-border/70 bg-muted/20 p-3">
                      <FileUp className="size-5 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">{t("upload.dropzone.title")}</p>
                      {selectedFile ? (
                        <p className="text-sm text-muted-foreground">
                          {t("upload.fields.fileSelected", { name: selectedFile.name })}
                        </p>
                      ) : null}
                    </div>
                    <Input id="csv-file" type="file" accept=".csv,.tsv,.xlsx,.xls,text/csv" className="hidden" onChange={(event) => void handleFilePicked(event.target.files?.[0] ?? null)} />
                  </div>
                </div>

                <div className="space-y-3">
                  <Field>
                    <FieldLabel>{t("upload.fields.wallet")}</FieldLabel>
                    <Select value={effectiveWalletId} onValueChange={(value) => setSelectedWalletId(value ?? "")}>
                    <SelectTrigger size="sm" className="w-full rounded-[10px] bg-background shadow-none">
                      <SelectValue>{selectedWalletName}</SelectValue>
                    </SelectTrigger>
                      <SelectContent>
                        <SelectGroup>
                          {walletOptions.map((wallet) => (
                            <SelectItem key={wallet.id} value={wallet.id}>
                              {wallet.name} · {wallet.currency}
                            </SelectItem>
                          ))}
                        </SelectGroup>
                      </SelectContent>
                    </Select>
                  </Field>

                </div>

                {preview && mapping ? (
                  <div className="space-y-4 border-t border-border/70 pt-4">
                    <div className="grid gap-3">
                      {BASIC_MAPPING_FIELDS.map((field) => (
                        <MappingField
                          key={field.key}
                          field={field}
                          mapping={mapping}
                          preview={preview}
                          t={t}
                          onChange={(key, value) => setMapping((current) => (current ? { ...current, [key]: value } : current))}
                        />
                      ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setShowAdvancedMapping((current) => !current)}
                      >
                        <SlidersHorizontal className="size-4" />
                        {showAdvancedMapping ? t("mapping.lessFields") : t("mapping.moreFields")}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={() => setShowPreviewRows((current) => !current)}
                      >
                        {showPreviewRows ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        {showPreviewRows ? t("mapping.hidePreview") : t("mapping.showPreview")}
                      </Button>
                    </div>

                    {showAdvancedMapping ? (
                      <div className="grid gap-3 border-t border-border/70 pt-4">
                        {ADVANCED_MAPPING_FIELDS.map((field) => (
                          <MappingField
                            key={field.key}
                            field={field}
                            mapping={mapping}
                            preview={preview}
                            t={t}
                            onChange={(key, value) => setMapping((current) => (current ? { ...current, [key]: value } : current))}
                          />
                        ))}
                      </div>
                    ) : null}

                    {showPreviewRows ? (
                      <div className="overflow-auto border-y border-border/70 bg-background/70">
                        <table className="min-w-full text-left text-xs">
                          <thead className="border-b border-border/70 bg-muted/20">
                            <tr>
                              {preview.columns.map((column) => (
                                <th key={column.key} className="px-3 py-2 font-medium">
                                  {column.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {preview.rows.map((row) => (
                              <tr key={row.rowIndex} className="border-b border-border/50 last:border-b-0">
                                {row.values.map((value, index) => (
                                  <td key={`${row.rowIndex}-${index}`} className="max-w-[160px] truncate px-3 py-2 text-muted-foreground">
                                    {value}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : null}
                  </div>
                ) : null}

                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    type="button"
                    disabled={uploadMutation.isPending || !selectedFile || !mapping || !canImportWithCurrentMapping(mapping)}
                    onClick={async () => {
                      try {
                        await uploadMutation.mutateAsync();
                      } catch (caughtError) {
                        setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.uploadFailed"));
                      }
                    }}
                  >
                    <FileUp data-icon="inline-start" />
                    {uploadMutation.isPending ? t("upload.pending") : t("upload.action")}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="shrink-0 px-3 py-2 sm:px-6 sm:py-4 lg:min-h-0 lg:flex-1 lg:overflow-auto lg:px-7">
            <div className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-heading text-[20px] leading-[1.12] tracking-[-0.028em] text-foreground sm:type-h3">
                    {t("upload.batchesTitle")}
                  </h3>
                </div>
                {visibleDraftBatches.length ? (
                  <div className="space-y-0">
                    {visibleDraftBatches.map((batch) => {
                      const status = batchStatus.get(batch.id);
                      const batchTransactions = draftTransactionsByBatchId.get(batch.id) ?? [];
                      const batchTitle = `${batch.wallet?.name ?? t("upload.unknownWallet")} (${status?.draftCount ?? 0})`;
                      const batchDateRange = formatBatchDateRange(batchTransactions, format);

                      return (
                        <div key={batch.id} className="flex items-start justify-between gap-3 py-3 first:pt-0 last:pb-0">
                          <div className="min-w-0 space-y-1">
                            <p className="type-body-14 truncate font-medium text-foreground">{batchTitle}</p>
                            {batchDateRange ? <p className="type-body-14 text-muted-foreground">{batchDateRange}</p> : null}
                          </div>
                          <Tooltip>
                            <TooltipTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className={actionButtonClassName}
                                  aria-label={t("upload.deleteBatch")}
                                  disabled={deleteBatchMutation.isPending}
                                />
                              }
                              onClick={async (event) => {
                                event.stopPropagation();
                                try {
                                  await deleteBatchMutation.mutateAsync(batch.id);
                                } catch (caughtError) {
                                  setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.deleteFailed"));
                                }
                              }}
                            >
                              <Trash2 />
                            </TooltipTrigger>
                            <TooltipContent>{t("upload.deleteBatch")}</TooltipContent>
                          </Tooltip>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState title={t("upload.emptyTitle")} description={t("upload.batchesEmpty")} />
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="hidden min-h-0 flex-col bg-background lg:flex">
          <div className="sticky top-0 z-10 bg-background/94 backdrop-blur supports-[backdrop-filter]:bg-background/84">
            <div className="px-3 pt-4 pb-3 sm:px-6 sm:pt-7 sm:pb-5 lg:px-7 lg:pt-8 lg:pb-6">
              <div className="flex items-start justify-between gap-3 px-1.5 sm:px-2.5">
                <div className="flex min-w-0 items-center gap-2.5">
                  <h2 className="min-w-0 truncate font-heading text-[28px] leading-none tracking-[-0.035em] text-foreground sm:type-h1">
                    {t("inbox.title")}
                  </h2>
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className={actionButtonClassName}
                          aria-label={t("inbox.description")}
                        />
                      }
                    >
                      <Info className="size-4 translate-y-[2px]" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-72 text-balance">
                      {t("inbox.description")}
                    </TooltipContent>
                  </Tooltip>
                </div>

                <div className="flex shrink-0 flex-col items-end gap-1 text-xs text-muted-foreground">
                  <span>{t("hero.stats.drafts")}: {data.draftTransactions.length}</span>
                </div>
              </div>

            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-3 pb-4 pt-2 sm:px-6 sm:pb-5 lg:px-7">
            {draftTransactions.length === 0 ? (
              <EmptyState title={t("inbox.emptyTitle")} description={t("inbox.emptyDescription")} />
            ) : (
              <div className="flex flex-col gap-6">
                {draftByDate.map(({ dateKey, dateLabel, transactions: dayTransactions }) => (
                  <section key={dateKey} className="flex flex-col">
                    <p className="type-body-12 mb-1 text-muted-foreground">{dateLabel}</p>
                    <div className="flex flex-col">
                      {dayTransactions.map((transaction) => {
                        const isTransfer = transaction.kind === "transfer" || transaction.kind === "debt_payment";
                        const categoriesForKind = categoryOptions.filter((c) => c.type === transaction.kind);
                        const walletAccountOptions = walletOptions.map((w) => ({ id: w.id, name: w.name }));

                        async function patchTransaction(values: Parameters<typeof updateMutation.mutateAsync>[0]["values"]) {
                          try {
                            await updateMutation.mutateAsync({ transactionId: transaction.id, values });
                          } catch (caughtError) {
                            setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.updateFailed"));
                          }
                        }

                        if (isTransfer) {
                          // Transfer/debt_payment: simplified row (different UI pattern)
                          const srcLabel = transaction.wallet?.name ?? transactionsT("row.unlinkedAccount");
                          const dstLabel = transaction.counterpart_wallet?.name ?? "—";
                          return (
                            <div
                              key={transaction.id}
                              className="flex items-start gap-3 border-t border-border py-3 first:border-t-0"
                            >
                              <div className="flex-1 min-w-0 flex flex-col gap-1">
                                <span className="type-body-14 font-medium text-muted-foreground">
                                  {transactionsT(`kinds.${transaction.kind}`)}
                                </span>
                                <span className="type-body-12 text-muted-foreground">
                                  {transaction.merchant_clean} · {srcLabel} → {dstLabel}
                                </span>
                              </div>
                              <span className="shrink-0 pt-0.5 tabular-nums type-body-14 font-semibold text-foreground">
                                {new Intl.NumberFormat(undefined, {
                                  style: "currency",
                                  currency: transaction.currency,
                                }).format(Math.abs(transaction.amount))}
                              </span>
                              <div className="flex shrink-0 items-center gap-0.5">
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className={actionButtonClassName}
                                        aria-label={commonT("delete")}
                                        disabled={deleteTransactionMutation.isPending}
                                      />
                                    }
                                    onClick={async () => {
                                      try { await deleteTransactionMutation.mutateAsync(transaction.id); } catch (e) {
                                        setActionError(e instanceof Error ? e.message : t("feedback.deleteTransactionFailed"));
                                      }
                                    }}
                                  >
                                    <Trash2 />
                                  </TooltipTrigger>
                                  <TooltipContent>{commonT("delete")}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className={actionButtonClassName}
                                        aria-label={t("inbox.confirmOne")}
                                        disabled={!isImportReadyForConfirmation(transaction)}
                                      />
                                    }
                                    onClick={async () => {
                                      try { await confirmMutation.mutateAsync([transaction.id]); } catch (e) {
                                        setActionError(e instanceof Error ? e.message : t("feedback.confirmFailed"));
                                      }
                                    }}
                                  >
                                    <Check />
                                  </TooltipTrigger>
                                  <TooltipContent>{t("inbox.confirmOne")}</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <PendingTransactionRow
                            key={transaction.id}
                            title={transaction.merchant_clean}
                            amount={Math.abs(transaction.amount)}
                            currency={transaction.currency}
                            kind={transaction.kind as "income" | "expense"}
                            occurredAt={transaction.occurred_at}
                            categories={categoriesForKind}
                            resolvedCategoryId={transaction.category_id}
                            onCategoryChange={(id) => void patchTransaction({ category_id: id })}
                            accounts={walletAccountOptions}
                            resolvedAccountId={transaction.wallet_id}
                            onAccountChange={(id) => id && void patchTransaction({ wallet_id: id })}
                            kindOptions={[
                              { value: "expense", label: t("kinds.expense") },
                              { value: "income", label: t("kinds.income") },
                            ]}
                            onKindChange={(kind) =>
                              void patchTransaction({
                                kind: kind as "expense" | "income",
                                category_id: null,
                              })
                            }
                            selectCategoryPlaceholder={transactionsT("row.uncategorized")}
                            noAccountPlaceholder={transactionsT("row.unlinkedAccount")}
                            clearCategoryLabel={transactionsT("row.uncategorized")}
                            actions={
                              <div className="flex items-center gap-0.5">
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className={actionButtonClassName}
                                        aria-label={commonT("delete")}
                                        disabled={deleteTransactionMutation.isPending}
                                      />
                                    }
                                    onClick={async () => {
                                      try { await deleteTransactionMutation.mutateAsync(transaction.id); } catch (e) {
                                        setActionError(e instanceof Error ? e.message : t("feedback.deleteTransactionFailed"));
                                      }
                                    }}
                                  >
                                    <Trash2 />
                                  </TooltipTrigger>
                                  <TooltipContent>{commonT("delete")}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className={actionButtonClassName}
                                        aria-label={commonT("edit")}
                                      />
                                    }
                                    onClick={() => setEditingImportId(transaction.id)}
                                  >
                                    <PencilLine />
                                  </TooltipTrigger>
                                  <TooltipContent>{commonT("edit")}</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger
                                    render={
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className={actionButtonClassName}
                                        aria-label={t("inbox.confirmOne")}
                                        disabled={!isImportReadyForConfirmation(transaction)}
                                      />
                                    }
                                    onClick={async () => {
                                      try { await confirmMutation.mutateAsync([transaction.id]); } catch (e) {
                                        setActionError(e instanceof Error ? e.message : t("feedback.confirmFailed"));
                                      }
                                    }}
                                  >
                                    <Check />
                                  </TooltipTrigger>
                                  <TooltipContent>{t("inbox.confirmOne")}</TooltipContent>
                                </Tooltip>
                              </div>
                            }
                          />
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
            <ImportDetailSheet
              key={editingImport?.id ?? "import-detail"}
              transaction={editingImport}
              open={Boolean(editingImportId && editingImport)}
              t={t}
              commonT={commonT}
              onOpenChange={(open) => {
                if (!open) {
                  setEditingImportId(null);
                }
              }}
              onPatch={async (values) => {
                if (!editingImport) {
                  return;
                }

                try {
                  await updateMutation.mutateAsync({
                    transactionId: editingImport.id,
                    values,
                  });
                } catch (caughtError) {
                  setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.updateFailed"));
                  throw caughtError;
                }
              }}
            />
          </div>
        </section>
      </div>
    </PageContainer>
  );
}
