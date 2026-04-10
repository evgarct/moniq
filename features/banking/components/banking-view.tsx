"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, FileUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { EmptyState } from "@/components/empty-state";
import { PageContainer } from "@/components/page-container";
import { SectionCard } from "@/components/section-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  bankingSnapshotQueryKey,
  batchConfirmImportedTransactionsRequest,
  updateImportedTransactionRequest,
  uploadCsvImportRequest,
} from "@/features/banking/lib/banking-api";
import { useBankingData } from "@/features/banking/hooks/use-banking-data";

function formatSignedAmount(amount: number, currency: string) {
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency,
    signDisplay: "always",
    maximumFractionDigits: 2,
  }).format(amount);
}

export function BankingView() {
  const t = useTranslations("imports");
  const commonT = useTranslations("common.actions");
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useBankingData();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchCategoryId, setBatchCategoryId] = useState<string>("");
  const [selectedWalletId, setSelectedWalletId] = useState<string>("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const setSnapshot = (snapshot: NonNullable<typeof data>) => {
    queryClient.setQueryData(bankingSnapshotQueryKey, snapshot);
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedWalletId) {
        throw new Error(t("upload.walletRequired"));
      }

      if (!selectedFile) {
        throw new Error(t("upload.fileRequired"));
      }

      return uploadCsvImportRequest({
        walletId: selectedWalletId,
        file: selectedFile,
      });
    },
    onSuccess: (snapshot) => {
      setSnapshot(snapshot);
      setSelectedFile(null);
      setActionError(null);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      transactionId,
      values,
    }: {
      transactionId: string;
      values: { merchant_clean?: string; category_id?: string | null };
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
      setSelectedIds([]);
      setActionError(null);
    },
  });

  const selectAllChecked = Boolean(data?.draftTransactions.length) && selectedIds.length === data?.draftTransactions.length;
  const categoryOptions = data?.categories.filter((category) => category.type === "expense" || category.type === "income") ?? [];
  const walletOptions = data?.wallets ?? [];

  const latestBatch = useMemo(() => data?.batches[0] ?? null, [data?.batches]);

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
        <EmptyState
          title={t("error.title")}
          description={error instanceof Error ? error.message : t("error.description")}
        />
      </PageContainer>
    );
  }

  return (
    <PageContainer className="flex flex-col gap-6 overflow-y-auto pb-24">
      {actionError ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{actionError}</div>
      ) : null}

      <SectionCard
        title={t("upload.title")}
        description={t("upload.description")}
        action={<Badge variant="secondary">{t("upload.batchCount", { count: data.batches.length })}</Badge>}
        contentClassName="flex flex-col gap-5"
      >
        <FieldGroup className="max-w-3xl">
          <Field>
            <FieldLabel>{t("upload.fields.wallet")}</FieldLabel>
            <Select value={selectedWalletId} onValueChange={(value) => setSelectedWalletId(value ?? "")}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("upload.fields.walletPlaceholder")} />
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
            <FieldDescription>{t("upload.fields.walletHint")}</FieldDescription>
          </Field>

          <Field>
            <FieldLabel htmlFor="csv-file">{t("upload.fields.file")}</FieldLabel>
            <Input
              id="csv-file"
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => setSelectedFile(event.target.files?.[0] ?? null)}
            />
            <FieldDescription>
              {selectedFile ? t("upload.fields.fileSelected", { name: selectedFile.name }) : t("upload.fields.fileHint")}
            </FieldDescription>
          </Field>
        </FieldGroup>

        <div className="flex flex-wrap gap-3">
          <Button
            type="button"
            onClick={async () => {
              try {
                await uploadMutation.mutateAsync();
              } catch (caughtError) {
                setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.uploadFailed"));
              }
            }}
            disabled={uploadMutation.isPending}
          >
            <FileUp data-icon="inline-start" />
            {uploadMutation.isPending ? t("upload.pending") : t("upload.action")}
          </Button>
          {latestBatch ? (
            <Badge variant="secondary">
              {t("upload.latestBatch", {
                file: latestBatch.file_name,
                count: latestBatch.imported_rows,
              })}
            </Badge>
          ) : null}
        </div>

        {data.batches.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.batches.map((batch) => (
              <div key={batch.id} className="rounded-xl border border-border bg-muted/20 px-4 py-3">
                <p className="font-medium">{batch.file_name}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {batch.wallet?.name ?? t("upload.unknownWallet")} · {t("upload.batchRows", { count: batch.imported_rows })}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">{new Date(batch.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState title={t("upload.emptyTitle")} description={t("upload.emptyDescription")} />
        )}
      </SectionCard>

      <SectionCard
        title={t("inbox.title")}
        description={t("inbox.description")}
        action={<Badge variant="secondary">{t("inbox.count", { count: data.draftTransactions.length })}</Badge>}
        contentClassName="flex flex-col gap-4"
      >
        {data.draftTransactions.length ? (
          <>
            <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/20 p-4 lg:flex-row lg:items-end">
              <FieldGroup className="flex-1">
                <Field>
                  <FieldLabel>{t("inbox.batchCategory")}</FieldLabel>
                  <Select value={batchCategoryId} onValueChange={(value) => setBatchCategoryId(value ?? "")}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder={t("inbox.selectCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {categoryOptions.map((category) => (
                          <SelectItem key={category.id} value={category.id}>
                            {category.name}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  disabled={!selectedIds.length || !batchCategoryId}
                  onClick={async () => {
                    try {
                      for (const transactionId of selectedIds) {
                        await updateMutation.mutateAsync({
                          transactionId,
                          values: { category_id: batchCategoryId },
                        });
                      }
                    } catch (caughtError) {
                      setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.updateFailed"));
                    }
                  }}
                >
                  {t("inbox.applyCategory")}
                </Button>
                <Button
                  type="button"
                  disabled={!selectedIds.length || confirmMutation.isPending}
                  onClick={async () => {
                    try {
                      await confirmMutation.mutateAsync(selectedIds);
                    } catch (caughtError) {
                      setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.confirmFailed"));
                    }
                  }}
                >
                  <CheckCheck data-icon="inline-start" />
                  {t("inbox.confirmSelected")}
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={!data.draftTransactions.length || confirmMutation.isPending}
                  onClick={async () => {
                    try {
                      await confirmMutation.mutateAsync(data.draftTransactions.map((transaction) => transaction.id));
                    } catch (caughtError) {
                      setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.confirmFailed"));
                    }
                  }}
                >
                  {t("inbox.confirmAll")}
                </Button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">
                      <Checkbox
                        checked={selectAllChecked}
                        onCheckedChange={(checked) =>
                          setSelectedIds(checked ? data.draftTransactions.map((transaction) => transaction.id) : [])
                        }
                        aria-label={commonT("selectAll")}
                      />
                    </TableHead>
                    <TableHead>{t("columns.merchant")}</TableHead>
                    <TableHead>{t("columns.wallet")}</TableHead>
                    <TableHead>{t("columns.amount")}</TableHead>
                    <TableHead>{t("columns.category")}</TableHead>
                    <TableHead>{t("columns.date")}</TableHead>
                    <TableHead>{t("columns.actions")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.draftTransactions.map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.includes(transaction.id)}
                          onCheckedChange={(checked) =>
                            setSelectedIds((current) =>
                              checked ? [...current, transaction.id] : current.filter((currentId) => currentId !== transaction.id),
                            )
                          }
                          aria-label={commonT("select")}
                        />
                      </TableCell>
                      <TableCell className="min-w-56">
                        <Input
                          value={transaction.merchant_clean}
                          onChange={(event) => {
                            const value = event.target.value;
                            queryClient.setQueryData(bankingSnapshotQueryKey, {
                              ...data,
                              draftTransactions: data.draftTransactions.map((current) =>
                                current.id === transaction.id ? { ...current, merchant_clean: value } : current,
                              ),
                            });
                          }}
                          onBlur={async (event) => {
                            try {
                              await updateMutation.mutateAsync({
                                transactionId: transaction.id,
                                values: { merchant_clean: event.target.value },
                              });
                            } catch (caughtError) {
                              setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.updateFailed"));
                            }
                          }}
                        />
                        <p className="mt-2 text-xs text-muted-foreground">{transaction.merchant_raw}</p>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {transaction.wallet?.name ?? t("upload.unknownWallet")}
                      </TableCell>
                      <TableCell className="font-medium">{formatSignedAmount(transaction.amount, transaction.currency)}</TableCell>
                      <TableCell className="min-w-48">
                        <Select
                          value={transaction.category_id ?? ""}
                          onValueChange={async (value) => {
                            try {
                              await updateMutation.mutateAsync({
                                transactionId: transaction.id,
                                values: { category_id: value || null },
                              });
                            } catch (caughtError) {
                              setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.updateFailed"));
                            }
                          }}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder={t("inbox.selectCategory")} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectGroup>
                              {categoryOptions.map((category) => (
                                <SelectItem key={category.id} value={category.id}>
                                  {category.name}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>{new Date(transaction.occurred_at).toLocaleDateString()}</TableCell>
                      <TableCell>
                        <Button
                          type="button"
                          size="sm"
                          onClick={async () => {
                            try {
                              await confirmMutation.mutateAsync([transaction.id]);
                            } catch (caughtError) {
                              setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.confirmFailed"));
                            }
                          }}
                        >
                          {t("inbox.confirmOne")}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <EmptyState title={t("inbox.emptyTitle")} description={t("inbox.emptyDescription")} />
        )}
      </SectionCard>

      <SectionCard
        title={t("confirmed.title")}
        description={t("confirmed.description")}
        action={<Badge variant="secondary">{t("confirmed.count", { count: data.confirmedTransactions.length })}</Badge>}
      >
        {data.confirmedTransactions.length ? (
          <div className="overflow-hidden rounded-xl border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("columns.merchant")}</TableHead>
                  <TableHead>{t("columns.wallet")}</TableHead>
                  <TableHead>{t("columns.amount")}</TableHead>
                  <TableHead>{t("columns.category")}</TableHead>
                  <TableHead>{t("columns.status")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.confirmedTransactions.map((transaction) => (
                  <TableRow key={transaction.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{transaction.merchant_clean}</span>
                        <span className="text-xs text-muted-foreground">{new Date(transaction.occurred_at).toLocaleDateString()}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {transaction.wallet?.name ?? t("upload.unknownWallet")}
                    </TableCell>
                    <TableCell>{formatSignedAmount(transaction.amount, transaction.currency)}</TableCell>
                    <TableCell>{transaction.category?.name ?? t("confirmed.uncategorized")}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {transaction.status === "edited" ? t("confirmed.edited") : t("confirmed.confirmed")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState title={t("confirmed.emptyTitle")} description={t("confirmed.emptyDescription")} />
        )}
      </SectionCard>
    </PageContainer>
  );
}
