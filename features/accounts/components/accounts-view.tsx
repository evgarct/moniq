"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Eye, EyeOff, Info, WalletCards, X } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccountList } from "@/components/account-list";
import { MoneyAmount } from "@/components/money-amount";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AccountFormSheet } from "@/features/accounts/components/account-form-sheet";
import { getCreditCardMetrics, isCreditCardAccount, isDebtAccount, isSavingsAccount } from "@/features/accounts/lib/account-utils";
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
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";
import type { Account, Allocation, FinanceSnapshot, Transaction } from "@/types/finance";
import type { AllocationInput, WalletInput } from "@/types/finance-schemas";

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
  const copy = t as unknown as (key: string) => string;
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [selectedAllocationId, setSelectedAllocationId] = useState<string | null>(null);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [walletSheetMode, setWalletSheetMode] = useState<"add" | "edit">("add");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [draftWalletType, setDraftWalletType] = useState<Account["type"]>("cash");
  const [walletsEditMode, setWalletsEditMode] = useState(false);
  const [showMinorUnits, setShowMinorUnits] = useState(false);
  const [mobileRegisterOpen, setMobileRegisterOpen] = useState(false);
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
  const selectedCreditCardMetrics =
    selectedAccount && isCreditCardAccount(selectedAccount) ? getCreditCardMetrics(selectedAccount) : null;
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
  const registerTitle = selectedAllocation ? selectedAllocation.name : selectedAccount ? selectedAccount.name : t("view.activity");
  const registerMeta = selectedAllocation && selectedAccount
    ? `${t("walletTypes.saving")} / ${selectedAccount.name} / ${selectedAccount.currency}`
    : selectedAccount
      ? `${t(`walletTypes.${selectedAccount.type}` as const)} / ${selectedAccount.currency}`
      : null;
  const toolbarButtonClassName =
    "rounded-md bg-transparent text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground active:bg-[#e6e1d9]";

  const isDesktopViewport = () =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1024px)").matches;

  function closeMobileRegister() {
    setMobileRegisterOpen(false);
    setSelectedAccountId(null);
    setSelectedAllocationId(null);
  }

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
    credit_limit: number | null;
    currency: CurrencyCode;
    debt_kind?: Account["debt_kind"];
  }) {
    try {
      const snapshot = await walletMutation.mutateAsync({
        mode: walletSheetMode,
        walletId: editingAccount?.id,
        values,
      });

      const nextSelectedId =
        walletSheetMode === "edit"
          ? editingAccount?.id ?? null
          : snapshot.accounts[snapshot.accounts.length - 1]?.id ?? null;

      setSelectedAccountId(nextSelectedId);
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
      <div className="grid h-full w-full grid-cols-1 lg:grid-cols-[minmax(320px,34vw)_minmax(0,1fr)]">
        <section className="flex min-h-0 flex-col border-b border-border bg-card lg:border-r lg:border-b-0">
          <div className="flex flex-col gap-3 px-3 pt-4 pb-3 sm:gap-4 sm:px-6 sm:pt-7 sm:pb-5 lg:px-7 lg:pt-8 lg:pb-6">
            <div className="flex items-start justify-between gap-2 px-1.5 sm:gap-3 sm:px-2.5">
              <div className="flex min-w-0 items-center gap-2">
                <h1 className="font-heading text-[28px] leading-none tracking-[-0.035em] text-foreground sm:type-h1">{t("view.title")}</h1>
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 rounded-md bg-transparent text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground active:bg-[#e6e1d9]"
                        aria-label={walletsEditMode ? copy("view.editModeDescription") : t("view.description")}
                      />
                    }
                  >
                    <Info className="size-4 translate-y-[2px]" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-72 text-balance">
                    {walletsEditMode ? copy("view.editModeDescription") : t("view.description")}
                  </TooltipContent>
                </Tooltip>
              </div>

              <div
                className="flex shrink-0 items-center gap-1 sm:gap-2"
                role="toolbar"
                aria-label={t("view.title")}
              >
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className={cn(
                          toolbarButtonClassName,
                          showMinorUnits && "bg-[#e6e1d9] text-foreground",
                        )}
                        aria-label={showMinorUnits ? copy("view.hideMinorUnits") : copy("view.showMinorUnits")}
                        aria-pressed={showMinorUnits}
                      />
                    }
                    onClick={() => setShowMinorUnits((current) => !current)}
                  >
                    {showMinorUnits ? <Eye /> : <EyeOff />}
                  </TooltipTrigger>
                  <TooltipContent>
                    {showMinorUnits ? copy("view.hideMinorUnits") : copy("view.showMinorUnits")}
                  </TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className={cn(
                          toolbarButtonClassName,
                          walletsEditMode && "bg-[#e6e1d9] text-foreground",
                        )}
                        aria-label={walletsEditMode ? t("view.finishWalletEditing") : t("view.addWallet")}
                        aria-pressed={walletsEditMode}
                      />
                    }
                    onClick={() => setWalletsEditMode((current) => !current)}
                    disabled={pending}
                  >
                    <WalletCards />
                  </TooltipTrigger>
                  <TooltipContent>
                    {walletsEditMode ? t("view.finishWalletEditing") : t("view.addWallet")}
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {!hasAccounts ? (
              <div className="rounded-2xl border border-dashed border-border/70 bg-background/65 px-4 py-3 type-body-14 text-muted-foreground">
                {walletsEditMode ? copy("view.emptyEditHint") : copy("view.emptyHint")}
              </div>
            ) : null}

            {actionError ? (
              <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {actionError}
              </div>
            ) : null}
          </div>

          <div className="min-h-0 flex-1 overflow-auto px-3 py-2 sm:px-6 sm:py-4 lg:px-7">
            <AccountList
              accounts={accounts}
              allocations={allocations}
              selectedAccountId={selectedAccountId}
              selectedAllocationId={selectedAllocationId}
              editing={walletsEditMode}
              showMinorUnits={showMinorUnits}
              onSelect={(accountId) => {
                setSelectedAllocationId(null);
                setSelectedAccountId((current) => {
                  const nextId = current === accountId ? null : accountId;

                  if (!isDesktopViewport()) {
                    setMobileRegisterOpen(Boolean(nextId));
                  }

                  return nextId;
                });
              }}
              onSelectAllocation={(allocation) => {
                setSelectedAccountId(allocation.account_id);
                setSelectedAllocationId((current) => {
                  const nextId = current === allocation.id ? null : allocation.id;

                  if (!isDesktopViewport()) {
                    setMobileRegisterOpen(Boolean(nextId));
                    if (!nextId) {
                      setSelectedAccountId(null);
                    }
                  }

                  return nextId;
                });
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

        <section className="hidden min-h-0 flex-col bg-background lg:flex">
          <div className="flex flex-col gap-4 px-4 py-4 sm:px-6 sm:py-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex flex-col gap-2">
                <p className="type-body-12 text-muted-foreground">{copy("view.registerEyebrow")}</p>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h2 className="type-h3">{registerTitle}</h2>
                  {registerMeta ? <p className="type-body-12 text-muted-foreground">{registerMeta}</p> : null}
                </div>
                <p className="type-body-14 text-muted-foreground">
                  {selectedAllocation
                    ? t("view.selectedGoalActivityDescription")
                    : selectedAccount
                      ? t("view.selectedActivityDescription")
                      : t("view.allActivityDescription")}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {selectedAccount ? (
                  <>
                    {selectedCreditCardMetrics ? (
                      <>
                        <MetricStat
                          label={t("metrics.limit")}
                          valueNode={
                            <MoneyAmount
                              amount={selectedCreditCardMetrics.limit}
                              currency={selectedAccount.currency}
                              display="absolute"
                              showMinorUnits={showMinorUnits}
                            />
                          }
                        />
                        <MetricStat
                          label={t("metrics.available")}
                          valueNode={
                            <MoneyAmount
                              amount={selectedCreditCardMetrics.available}
                              currency={selectedAccount.currency}
                              display="absolute"
                              showMinorUnits={showMinorUnits}
                            />
                          }
                        />
                        <MetricStat
                          label={t("metrics.debt")}
                          valueNode={
                            <MoneyAmount
                              amount={selectedCreditCardMetrics.debt}
                              currency={selectedAccount.currency}
                              display="absolute"
                              tone="negative"
                              showMinorUnits={showMinorUnits}
                            />
                          }
                        />
                      </>
                    ) : (
                      <MetricStat
                        label={t("metrics.balance")}
                        valueNode={
                          <MoneyAmount
                            amount={selectedAllocation ? selectedAllocation.amount : selectedAccount.balance}
                            currency={selectedAccount.currency}
                            display={selectedAllocation ? "absolute" : isDebtAccount(selectedAccount) ? "signed" : "absolute"}
                            showMinorUnits={showMinorUnits}
                            tone="default"
                          />
                        }
                      />
                    )}
                    {selectedTargetedAllocation ? (
                      <MetricStat
                        label={t("metrics.target")}
                        valueNode={
                          <MoneyAmount
                            amount={selectedTargetedAllocation.target_amount ?? 0}
                            currency={selectedAccount.currency}
                            display="absolute"
                            showMinorUnits={showMinorUnits}
                          />
                        }
                      />
                    ) : null}
                    {selectedTargetedAllocation && selectedTargetedAllocationProgress !== null ? (
                      <MetricStat label={t("metrics.progress")} value={`${selectedTargetedAllocationProgress}%`} />
                    ) : null}
                    {isSavingsAccount(selectedAccount) && !selectedAllocation ? (
                      <>
                        <MetricStat
                          label={t("metrics.allocated")}
                          valueNode={
                            <MoneyAmount
                              amount={selectedAllocatedTotal}
                              currency={selectedAccount.currency}
                              display="absolute"
                              showMinorUnits={showMinorUnits}
                            />
                          }
                        />
                        <MetricStat
                          label={t("metrics.free")}
                          valueNode={
                            <MoneyAmount
                              amount={freeMoney}
                              currency={selectedAccount.currency}
                              display="absolute"
                              showMinorUnits={showMinorUnits}
                            />
                          }
                        />
                      </>
                    ) : null}
                    <div className="flex items-end justify-start xl:justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="rounded-md bg-transparent px-3 text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground active:bg-[#e6e1d9]"
                        aria-label={t("view.showAllWallets")}
                        onClick={() => {
                          setSelectedAccountId(null);
                          setSelectedAllocationId(null);
                        }}
                      >
                        <X data-icon="inline-start" />
                        {t("view.showAllWallets")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <MetricStat label={t("metrics.transactions")} value={`${register.length}`} />
                )}
              </div>
            </div>
          </div>

          <Separator />

          <div className="min-h-0 flex-1 overflow-auto px-4 py-2 sm:px-6">
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
              showMinorUnits={showMinorUnits}
            />
          </div>
        </section>
      </div>

      <Sheet
        open={mobileRegisterOpen}
        onOpenChange={(open) => {
          if (!open) {
            closeMobileRegister();
          }
        }}
      >
        <SheetContent
          side="fullscreen"
          className="gap-0 p-0 lg:hidden"
          showCloseButton={false}
        >
          <SheetHeader className="border-b px-4 py-3">
            <div className="flex items-start gap-3">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="mt-0.5 rounded-md bg-transparent text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground active:bg-[#e6e1d9]"
                aria-label={tr("common.actions.back")}
                onClick={closeMobileRegister}
              >
                <ArrowLeft />
              </Button>
              <div className="min-w-0">
                <SheetTitle className="type-h3">{registerTitle}</SheetTitle>
                <SheetDescription className="type-body-12 text-muted-foreground">
                  {registerMeta ?? t("view.allActivityDescription")}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-auto px-4 py-4">
            <TransactionList
              transactions={register}
              emptyMessage={
                selectedAllocation
                  ? t("messages.noTransactionsForGoal")
                  : selectedAccount
                    ? t("messages.noTransactionsForWallet")
                    : tr("common.empty.noTransactionsYet")
              }
              showMinorUnits={showMinorUnits}
            />
          </div>
        </SheetContent>
      </Sheet>

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

function MetricStat({
  label,
  value,
  valueNode,
}: {
  label: string;
  value?: string;
  valueNode?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg bg-card/85 px-3 py-2">
      <p className="type-body-12 text-muted-foreground">{label}</p>
      <div className="mt-1 truncate type-h6">{valueNode ?? value}</div>
    </div>
  );
}
