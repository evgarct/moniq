"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCheck, Landmark, RefreshCcw } from "lucide-react";
import { useSearchParams } from "next/navigation";
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
  connectBankRequest,
  syncBankTransactionsRequest,
  updateImportedTransactionRequest,
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
  const t = useTranslations("banking");
  const commonT = useTranslations("common.actions");
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { data, error, isLoading } = useBankingData();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchCategoryId, setBatchCategoryId] = useState<string>("");
  const [connectBankName, setConnectBankName] = useState("MockBank");
  const [actionError, setActionError] = useState<string | null>(null);

  const setSnapshot = (snapshot: NonNullable<typeof data>) => {
    queryClient.setQueryData(bankingSnapshotQueryKey, snapshot);
  };

  const connectMutation = useMutation({
    mutationFn: async () =>
      connectBankRequest({
        redirectUrl: `${window.location.origin}/api/banking/callback`,
        aspspName: connectBankName,
      }),
    onSuccess: ({ redirectUrl }) => {
      window.location.assign(redirectUrl);
    },
  });

  const syncMutation = useMutation({
    mutationFn: syncBankTransactionsRequest,
    onSuccess: (snapshot) => {
      setSnapshot(snapshot);
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

  const callbackStatus = searchParams.get("status");
  const callbackMessage = searchParams.get("message");

  const selectAllChecked = Boolean(data?.draftTransactions.length) && selectedIds.length === data?.draftTransactions.length;
  const categoryOptions = data?.categories.filter((category) => category.type === "expense" || category.type === "income") ?? [];
  const statusBanner = useMemo(() => {
    if (callbackStatus === "connected") {
      return { tone: "success" as const, message: t("feedback.connected") };
    }

    if (callbackStatus === "error" && callbackMessage) {
      return { tone: "error" as const, message: callbackMessage };
    }

    return null;
  }, [callbackMessage, callbackStatus, t]);

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
      {statusBanner ? (
        <div
          className={
            statusBanner.tone === "success"
              ? "rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
              : "rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800"
          }
        >
          {statusBanner.message}
        </div>
      ) : null}
      {actionError ? <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{actionError}</div> : null}

      <SectionCard
        title={t("connect.title")}
        description={t("connect.description")}
        action={
          data.connection?.status === "connected" ? (
            <Button
              type="button"
              onClick={async () => {
                try {
                  await syncMutation.mutateAsync();
                } catch (caughtError) {
                  setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.syncFailed"));
                }
              }}
              disabled={syncMutation.isPending}
            >
              <RefreshCcw data-icon="inline-start" className={syncMutation.isPending ? "animate-spin" : undefined} />
              {syncMutation.isPending ? t("connect.syncPending") : t("connect.sync")}
            </Button>
          ) : null
        }
      >
        {data.connection?.status === "connected" ? (
          <div className="flex flex-col gap-4 rounded-xl border border-border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant="secondary">{t("connect.connectedBadge")}</Badge>
              <span className="text-sm text-muted-foreground">
                {t("connect.connectedDetails", {
                  bank: data.connection.aspsp_name,
                  accounts: data.accounts.length,
                })}
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.accounts.map((account) => (
                <div key={account.id} className="rounded-xl border border-border bg-background px-4 py-3">
                  <p className="font-medium">{account.name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {account.currency}
                    {account.last_sync_date ? ` • ${t("connect.lastSync", { date: new Date(account.last_sync_date).toLocaleString() })}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-5">
            <FieldGroup className="max-w-xl">
              <Field>
                <FieldLabel htmlFor="bank-name">{t("connect.fields.bankName")}</FieldLabel>
                <Input
                  id="bank-name"
                  value={connectBankName}
                  onChange={(event) => setConnectBankName(event.target.value)}
                />
                <FieldDescription>{t("connect.fields.bankHint")}</FieldDescription>
              </Field>
            </FieldGroup>
            <EmptyState
              className="text-left"
              title={t("connect.emptyTitle")}
              description={t("connect.emptyDescription")}
              action={
                <Button
                  type="button"
                  onClick={async () => {
                    try {
                      await connectMutation.mutateAsync();
                    } catch (caughtError) {
                      setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.connectFailed"));
                    }
                  }}
                  disabled={connectMutation.isPending}
                >
                  <Landmark data-icon="inline-start" />
                  {connectMutation.isPending ? t("connect.pending") : t("connect.action")}
                </Button>
              }
            />
          </div>
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
                      await Promise.all(
                        selectedIds.map((transactionId) =>
                          updateMutation.mutateAsync({ transactionId, values: { category_id: batchCategoryId } }),
                        ),
                      );
                    } catch (caughtError) {
                      setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.updateFailed"));
                    }
                  }}
                >
                  {t("inbox.applyCategory")}
                </Button>
                <Button
                  type="button"
                  disabled={!selectedIds.length}
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
                  variant="outline"
                  disabled={!data.draftTransactions.length}
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

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>
                    <Checkbox
                      checked={selectAllChecked}
                      onCheckedChange={(checked) => {
                        setSelectedIds(checked ? data.draftTransactions.map((transaction) => transaction.id) : []);
                      }}
                    />
                  </TableHead>
                  <TableHead>{t("columns.merchant")}</TableHead>
                  <TableHead>{t("columns.account")}</TableHead>
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
                            checked ? [...current, transaction.id] : current.filter((value) => value !== transaction.id),
                          )
                        }
                      />
                    </TableCell>
                    <TableCell className="min-w-52">
                      <Input
                        defaultValue={transaction.merchant_clean}
                        onBlur={async (event) => {
                          const nextValue = event.currentTarget.value.trim();
                          if (!nextValue || nextValue === transaction.merchant_clean) {
                            return;
                          }

                          try {
                            await updateMutation.mutateAsync({
                              transactionId: transaction.id,
                              values: { merchant_clean: nextValue },
                            });
                          } catch (caughtError) {
                            setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.updateFailed"));
                          }
                        }}
                      />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{transaction.banking_account?.name ?? "—"}</TableCell>
                    <TableCell>{formatSignedAmount(transaction.amount, transaction.currency)}</TableCell>
                    <TableCell className="min-w-44">
                      <Select
                        value={transaction.category_id ?? ""}
                        onValueChange={async (value) => {
                          try {
                            await updateMutation.mutateAsync({
                              transactionId: transaction.id,
                              values: { category_id: value ?? null },
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
                    <TableCell>{transaction.transaction_date}</TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={async () => {
                            try {
                              await updateMutation.mutateAsync({
                                transactionId: transaction.id,
                                values: {
                                  merchant_clean: transaction.merchant_clean,
                                  category_id: transaction.category_id,
                                },
                              });
                            } catch (caughtError) {
                              setActionError(caughtError instanceof Error ? caughtError.message : t("feedback.updateFailed"));
                            }
                          }}
                        >
                          {commonT("save")}
                        </Button>
                        <Button
                          type="button"
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
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.merchant")}</TableHead>
                <TableHead>{t("columns.account")}</TableHead>
                <TableHead>{t("columns.amount")}</TableHead>
                <TableHead>{t("columns.category")}</TableHead>
                <TableHead>{t("columns.date")}</TableHead>
                <TableHead>{t("columns.status")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.confirmedTransactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{transaction.merchant_clean}</TableCell>
                  <TableCell className="text-muted-foreground">{transaction.banking_account?.name ?? "—"}</TableCell>
                  <TableCell>{formatSignedAmount(transaction.amount, transaction.currency)}</TableCell>
                  <TableCell>{transaction.category?.name ?? t("confirmed.uncategorized")}</TableCell>
                  <TableCell>{transaction.transaction_date}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {transaction.status === "edited" ? t("confirmed.edited") : t("confirmed.confirmed")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title={t("confirmed.emptyTitle")} description={t("confirmed.emptyDescription")} />
        )}
      </SectionCard>
    </PageContainer>
  );
}
