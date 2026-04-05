"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilLine, Plus, Scale, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccountList } from "@/components/account-list";
import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { TransactionList } from "@/components/transaction-list";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AccountFormSheet } from "@/features/accounts/components/account-form-sheet";
import { isDebtAccount, isSavingsAccount } from "@/features/accounts/lib/account-utils";
import { AllocationFormSheet } from "@/features/allocations/components/allocation-form-sheet";
import {
  getAllocatedTotalForAccount,
  getFreeMoney,
  getAllocationProgress,
  isTargetedAllocation,
  validateAllocationAmount,
} from "@/features/allocations/lib/allocation-utils";
import {
  createAllocationRequest,
  createWalletRequest,
  deleteAllocationRequest,
  deleteWalletRequest,
  financeSnapshotQueryKey,
  updateAllocationRequest,
  updateWalletRequest,
} from "@/features/finance/lib/finance-api";
import { isSettledTransactionStatus } from "@/features/transactions/lib/transaction-schedules";
import { getTransactionsForAccount, getTransactionsForAllocation } from "@/lib/finance-selectors";
import type { CurrencyCode } from "@/types/currency";
import type { AllocationInput, WalletInput } from "@/types/finance-schemas";
import type { Account, Allocation, FinanceSnapshot, Transaction } from "@/types/finance";

export function AccountsView({
  accounts,
  allocations,
  transactions,
}: {
  accounts: Account[];
  allocations: Allocation[];
  transactions: Transaction[];
}) {
  const tr = useTranslations();
  const t = useTranslations("accounts");
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [walletSheetMode, setWalletSheetMode] = useState<"add" | "edit">("add");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [draftWalletType, setDraftWalletType] = useState<Account["type"]>("cash");
  const [walletsEditMode, setWalletsEditMode] = useState(false);
  const [allocationSheetOpen, setAllocationSheetOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const setSnapshot = (snapshot: FinanceSnapshot) => {
    queryClient.setQueryData(financeSnapshotQueryKey, snapshot);
  };

  const walletMutation = useMutation({
    mutationFn: async ({ mode, walletId, values }: { mode: "add" | "edit"; walletId?: string; values: WalletInput }) =>
      mode === "add" ? createWalletRequest(values) : updateWalletRequest(walletId!, values),
    onSuccess: (snapshot) => {
      setSnapshot(snapshot);
      setActionError(null);
    },
  });

  const deleteWalletMutation = useMutation({
    mutationFn: deleteWalletRequest,
    onSuccess: (snapshot) => {
      setSnapshot(snapshot);
      setActionError(null);
    },
  });

  const allocationMutation = useMutation({
    mutationFn: async ({
      mode,
      walletId,
      allocationId,
      values,
    }: {
      mode: "add" | "edit";
      walletId?: string;
      allocationId?: string;
      values: AllocationInput;
    }) => (mode === "add" ? createAllocationRequest(walletId!, values) : updateAllocationRequest(allocationId!, values)),
    onSuccess: (snapshot) => {
      setSnapshot(snapshot);
      setActionError(null);
    },
  });

  const deleteAllocationMutation = useMutation({
    mutationFn: deleteAllocationRequest,
    onSuccess: (snapshot) => {
      setSnapshot(snapshot);
      setActionError(null);
    },
  });

  const selectedAccount = selectedAccountId ? accounts.find((account) => account.id === selectedAccountId) ?? null : null;
  const selectedAllocation =
    selectedAllocationId ? allocations.find((allocation) => allocation.id === selectedAllocationId) ?? null : null;
  const selectedTargetedAllocation =
    selectedAllocation && isTargetedAllocation(selectedAllocation) ? selectedAllocation : null;
  const selectedTargetedAllocationProgress = selectedTargetedAllocation
    ? Math.round((getAllocationProgress(selectedTargetedAllocation) ?? 0) * 100)
    : null;
  const settledTransactions = useMemo(
    () =>
      [...transactions]
        .filter((transaction) => isSettledTransactionStatus(transaction.status))
        .sort((left, right) => right.occurred_at.localeCompare(left.occurred_at)),
    [transactions],
  );
  const register = selectedAllocation
    ? getTransactionsForAllocation(settledTransactions, selectedAllocation.id)
    : selectedAccount
      ? getTransactionsForAccount(settledTransactions, selectedAccount.id)
      : settledTransactions;
  const freeMoney = selectedAccount ? getFreeMoney(selectedAccount.balance, allocations, selectedAccount.id) : 0;
  const selectedAllocatedTotal = selectedAccount ? getAllocatedTotalForAccount(allocations, selectedAccount.id) : 0;
  const pending =
    walletMutation.isPending ||
    deleteWalletMutation.isPending ||
    allocationMutation.isPending ||
    deleteAllocationMutation.isPending;
  const hasAccounts = accounts.length > 0;

  const emptyAction = useMemo(
    () => (
      <Button
        onClick={() => {
          setActionError(null);
          setWalletSheetMode("add");
          setEditingAccount(null);
          setWalletSheetOpen(true);
        }}
        disabled={pending}
      >
        <Plus data-icon="inline-start" />
        {t("view.addWallet")}
      </Button>
    ),
    [pending, t],
  );

  function openAddWallet(type: Account["type"] = "cash") {
    setActionError(null);
    setWalletSheetMode("add");
    setEditingAccount(null);
    setDraftWalletType(type);
    setWalletSheetOpen(true);
  }

  function openEditWallet(account: Account) {
    setActionError(null);
    setWalletSheetMode("edit");
    setEditingAccount(account);
    setDraftWalletType(account.type);
    setWalletSheetOpen(true);
  }

  async function handleSaveWallet(values: {
    name: string;
    type: Account["type"];
    balance: number;
    currency: CurrencyCode;
    debt_kind?: Account["debt_kind"];
  }) {
    try {
      const snapshot = await walletMutation.mutateAsync({
        mode: walletSheetMode,
        walletId: editingAccount?.id,
        values,
      });

      const selectedId =
        walletSheetMode === "edit"
          ? editingAccount?.id ?? null
          : snapshot.accounts[0]?.id ?? null;

      setSelectedAccountId(selectedId);
      setSelectedAllocationId(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : t("messages.saveWalletError");
      setActionError(message);
      throw error;
    }
  }

  async function handleDeleteWallet(account: Account) {
    if (!window.confirm(t("messages.deleteWalletConfirm", { name: account.name }))) {
      return;
    }

    try {
      await deleteWalletMutation.mutateAsync(account.id);
      setSelectedAccountId((current) => (current === account.id ? null : current));
      setSelectedAllocationId((current) =>
        current && allocations.some((allocation) => allocation.id === current && allocation.account_id === account.id) ? null : current,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : t("messages.deleteWalletError");
      setActionError(message);
      window.alert(message);
    }
  }

  function openAddSubgroup() {
    setActionError(null);
    setEditingAllocation(null);
    setAllocationSheetOpen(true);
  }

  async function handleSaveAllocation(values: { name: string; amount: number; kind: Allocation["kind"]; target_amount: number | null }) {
    if (!selectedAccount) {
      return;
    }

    try {
      validateAllocationAmount({
        balance: selectedAccount.balance,
        allocations,
        accountId: selectedAccount.id,
        nextAmount: values.amount,
        nextKind: values.kind,
        nextTargetAmount: values.target_amount,
        editingAllocationId: editingAllocation?.id,
      });

      await allocationMutation.mutateAsync({
        mode: editingAllocation ? "edit" : "add",
        walletId: selectedAccount.id,
        allocationId: editingAllocation?.id,
        values,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : t("messages.saveGoalError");
      setActionError(message);
      window.alert(message);
      throw error;
    }
  }

  async function handleDeleteAllocation(allocation: Allocation) {
    if (!window.confirm(t("messages.deleteGoalConfirm", { name: allocation.name }))) {
      return;
    }

    try {
      await deleteAllocationMutation.mutateAsync(allocation.id);
      setSelectedAllocationId((current) => (current === allocation.id ? null : current));
    } catch (error) {
      const message = error instanceof Error ? error.message : t("messages.deleteGoalError");
      setActionError(message);
      window.alert(message);
    }
  }

  return (
    <>
      {accounts.length ? (
        <div className="grid h-full w-full grid-cols-1 lg:grid-cols-[minmax(320px,36vw)_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col border-b border-border bg-card lg:border-r lg:border-b-0">
            <div className="flex flex-col gap-5 px-8 py-8">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full border border-border/80 bg-background text-foreground">
                    <Scale className="size-[18px]" strokeWidth={1.7} />
                  </div>
                  <div className="flex flex-col gap-1">
                    <h1 className="type-h3">{t("view.title")}</h1>
                    <p className="type-body-14 max-w-[34rem] text-muted-foreground">
                      {t("view.description")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger
                      render={
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-full border border-border/70 bg-background"
                          aria-label={walletsEditMode ? t("view.finishWalletEditing") : t("view.manageWallets")}
                        />
                      }
                      onClick={() => setWalletsEditMode((current) => !current)}
                      disabled={pending}
                    >
                      <PencilLine />
                    </TooltipTrigger>
                    <TooltipContent>
                      {walletsEditMode ? t("view.finishWalletEditing") : t("view.manageWallets")}
                    </TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger
                      render={<Button variant="ghost" size="icon-sm" className="rounded-full border border-border/70 bg-background" aria-label={t("view.addWallet")} />}
                      onClick={() => openAddWallet()}
                    >
                      <Plus />
                    </TooltipTrigger>
                    <TooltipContent>{t("view.addWallet")}</TooltipContent>
                  </Tooltip>
                </div>
              </div>

              {actionError ? (
                <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {actionError}
                </div>
              ) : null}
            </div>

            <Separator />

            <div className="min-h-0 flex-1 overflow-auto px-8 py-5">
              <AccountList
                accounts={accounts}
                allocations={allocations}
                selectedAccountId={selectedAccountId}
                selectedAllocationId={selectedAllocationId}
                editing={walletsEditMode}
                onSelect={(accountId) => {
                  setSelectedAllocationId(null);
                  setSelectedAccountId((current) => (current === accountId ? null : accountId));
                }}
                onSelectAllocation={(allocation) => {
                  setSelectedAccountId(allocation.account_id);
                  setSelectedAllocationId((current) => (current === allocation.id ? null : allocation.id));
                }}
                onAddAccount={openAddWallet}
                onEditAccount={openEditWallet}
                onDeleteAccount={handleDeleteWallet}
                onAddSubgroup={(account) => {
                  setSelectedAccountId(account.id);
                  openAddSubgroup();
                }}
                onEditAllocation={(allocation) => {
                  setSelectedAccountId(allocation.account_id);
                  setEditingAllocation(allocation);
                  setAllocationSheetOpen(true);
                }}
                onDeleteAllocation={handleDeleteAllocation}
              />
            </div>
          </section>

          <section className="flex min-h-0 flex-col bg-background">
            <div className="flex flex-col gap-4 px-6 py-6">
              <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="type-h3">
                      {selectedAllocation ? selectedAllocation.name : selectedAccount ? selectedAccount.name : t("view.activity")}
                    </h2>
                    {selectedAllocation && selectedAccount ? (
                      <>
                        <Badge variant="secondary">{t("walletTypes.saving")}</Badge>
                        <Badge variant="outline">{selectedAccount.name}</Badge>
                        <Badge variant="outline">{selectedAccount.currency}</Badge>
                      </>
                    ) : selectedAccount ? (
                      <>
                        <Badge variant="secondary">{t(`walletTypes.${selectedAccount.type}` as const)}</Badge>
                        <Badge variant="outline">{selectedAccount.currency}</Badge>
                      </>
                    ) : null}
                  </div>
                  <p className="type-body-14 text-muted-foreground">
                    {selectedAllocation
                      ? t("view.selectedGoalActivityDescription")
                      : selectedAccount
                      ? t("view.selectedActivityDescription")
                      : t("view.allActivityDescription")}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedAccount ? (
                    <>
                      <MetricPill
                        label={t("metrics.balance")}
                        valueNode={
                          <MoneyAmount
                            amount={selectedAllocation ? selectedAllocation.amount : selectedAccount.balance}
                            currency={selectedAccount.currency}
                            display={selectedAllocation ? "absolute" : isDebtAccount(selectedAccount) ? "signed" : "absolute"}
                            tone="default"
                          />
                        }
                      />
                      {selectedTargetedAllocation ? (
                        <MetricPill
                          label={t("metrics.target")}
                          valueNode={
                            <MoneyAmount
                              amount={selectedTargetedAllocation.target_amount ?? 0}
                              currency={selectedAccount.currency}
                              display="absolute"
                            />
                          }
                        />
                      ) : null}
                      {selectedTargetedAllocation && selectedTargetedAllocationProgress !== null ? (
                        <MetricPill
                          label={t("metrics.progress")}
                          value={`${selectedTargetedAllocationProgress}%`}
                        />
                      ) : null}
                      {isSavingsAccount(selectedAccount) && !selectedAllocation ? (
                        <>
                          <MetricPill
                            label={t("metrics.allocated")}
                            valueNode={
                              <MoneyAmount
                                amount={selectedAllocatedTotal}
                                currency={selectedAccount.currency}
                                display="absolute"
                              />
                            }
                          />
                          <MetricPill
                            label={t("metrics.free")}
                            valueNode={
                              <MoneyAmount amount={freeMoney} currency={selectedAccount.currency} display="absolute" />
                            }
                          />
                        </>
                      ) : null}
                      <Tooltip>
                        <TooltipTrigger
                          render={<Button variant="outline" size="icon-sm" className="rounded-full bg-background" aria-label={t("view.showAllWallets")} />}
                          onClick={() => setSelectedAccountId(null)}
                        >
                          <X />
                        </TooltipTrigger>
                        <TooltipContent>{t("view.showAllWallets")}</TooltipContent>
                      </Tooltip>
                    </>
                  ) : hasAccounts ? (
                    <MetricPill label={t("metrics.transactions")} value={`${register.length}`} />
                  ) : null}
                </div>
              </div>
            </div>

            <Separator />

            <div className="min-h-0 flex-1 overflow-auto px-6 py-3">
              <TransactionList
                transactions={register}
                emptyMessage={
                  selectedAllocation
                    ? t("messages.noTransactionsForGoal")
                    : selectedAccount
                    ? t("messages.noTransactionsForWallet")
                    : tr("common.empty.noTransactionsYet")
                }
                compact
              />
            </div>
          </section>
        </div>
      ) : (
        <div className="flex h-full items-center justify-center px-4">
          <EmptyState
            title={t("view.noBalanceSpacesTitle")}
            description={t("view.noBalanceSpacesDescription")}
            action={emptyAction}
            className="w-full max-w-md"
          />
        </div>
      )}

      <AccountFormSheet
        open={walletSheetOpen}
        mode={walletSheetMode}
        account={editingAccount}
        initialType={draftWalletType}
        onOpenChange={setWalletSheetOpen}
        onSubmit={handleSaveWallet}
      />

      {selectedAccount?.type === "saving" ? (
        <AllocationFormSheet
          open={allocationSheetOpen}
          mode={editingAllocation ? "edit" : "add"}
          allocation={editingAllocation}
          currency={selectedAccount.currency}
          freeMoney={freeMoney}
          onOpenChange={setAllocationSheetOpen}
          onSubmit={handleSaveAllocation}
        />
      ) : null}
    </>
  );
}

function MetricPill({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/80 bg-card px-3.5 py-2.5">
      <p className="type-body-12 tracking-[0.02em]">{label}</p>
      <div className="mt-1 type-h6">{valueNode ?? value}</div>
    </div>
  );
}
