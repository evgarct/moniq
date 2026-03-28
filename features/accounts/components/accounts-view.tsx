"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarRange, PencilLine, Plus, X } from "lucide-react";

import { AccountList } from "@/components/account-list";
import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { Surface } from "@/components/surface";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { AccountFormSheet } from "@/features/accounts/components/account-form-sheet";
import { getAccountTypeLabel, isDebtAccount, isSavingsAccount } from "@/features/accounts/lib/account-utils";
import { AllocationFormSheet } from "@/features/allocations/components/allocation-form-sheet";
import {
  getAllocatedTotalForAccount,
  getAllocationsForAccount,
  getFreeMoney,
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
import { getTransactionsForAccount } from "@/lib/finance-selectors";
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
  const queryClient = useQueryClient();
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
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

  const register = selectedAccount ? getTransactionsForAccount(transactions, selectedAccount.id) : transactions;
  const accountAllocations = selectedAccount ? getAllocationsForAccount(allocations, selectedAccount.id) : [];
  const freeMoney = selectedAccount ? getFreeMoney(selectedAccount.balance, allocations, selectedAccount.id) : 0;
  const savingsMode = selectedAccount ? isSavingsAccount(selectedAccount) : false;
  const selectedBalance = selectedAccount?.balance ?? 0;
  const selectedCreatedAt = selectedAccount?.created_at ?? null;
  const pending =
    walletMutation.isPending ||
    deleteWalletMutation.isPending ||
    allocationMutation.isPending ||
    deleteAllocationMutation.isPending;
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
        <Plus className="h-4 w-4" />
        Add wallet
      </Button>
    ),
    [pending],
  );

  if (!accounts.length) {
    return (
      <EmptyState
        title="No wallets yet"
        description="Create your first wallet to start organizing real balances in Supabase."
        action={emptyAction}
      />
    );
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
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save wallet.";
      setActionError(message);
      throw error;
    }
  }

  async function handleDeleteWallet(account: Account) {
    if (!account) {
      return;
    }

    if (!window.confirm(`Delete wallet "${account.name}"?`)) {
      return;
    }

    try {
      await deleteWalletMutation.mutateAsync(account.id);
      setSelectedAccountId((current) => (current === account.id ? null : current));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete wallet.";
      setActionError(message);
      window.alert(message);
    }
  }

  function openAddSubgroup() {
    setActionError(null);
    setEditingAllocation(null);
    setAllocationSheetOpen(true);
  }

  async function handleSaveAllocation(values: { name: string; amount: number }) {
    if (!selectedAccount) {
      return;
    }

    try {
      validateAllocationAmount({
        balance: selectedAccount.balance,
        allocations,
        accountId: selectedAccount.id,
        nextAmount: values.amount,
        editingAllocationId: editingAllocation?.id,
      });

      await allocationMutation.mutateAsync({
        mode: editingAllocation ? "edit" : "add",
        walletId: selectedAccount.id,
        allocationId: editingAllocation?.id,
        values,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to save subgroup.";
      setActionError(message);
      window.alert(message);
      throw error;
    }
  }

  async function handleDeleteAllocation(allocation: Allocation) {
    if (!window.confirm(`Delete subgroup "${allocation.name}"?`)) {
      return;
    }

    try {
      await deleteAllocationMutation.mutateAsync(allocation.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to delete subgroup.";
      setActionError(message);
      window.alert(message);
    }
  }

  return (
    <>
      <div className="grid h-full gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="h-full overflow-auto">
          <Surface tone="canvas" padding="md" className="h-full rounded-[26px]">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-[18px] font-medium text-slate-900">Wallets</h2>
                  <Button
                    variant={walletsEditMode ? "default" : "ghost"}
                    size="icon-sm"
                    className="rounded-lg"
                    onClick={() => setWalletsEditMode((current) => !current)}
                    title={walletsEditMode ? "Finish editing wallets" : "Edit wallets"}
                    aria-label={walletsEditMode ? "Finish editing wallets" : "Edit wallets"}
                  >
                    <PencilLine className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedAccount ? (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="rounded-xl bg-white"
                    onClick={() => setSelectedAccountId(null)}
                    title="Clear wallet filter"
                    aria-label="Clear wallet filter"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            {actionError ? (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
                {actionError}
              </div>
            ) : null}
            <AccountList
              accounts={accounts}
              allocations={allocations}
              selectedAccountId={selectedAccountId}
              editing={walletsEditMode}
              onSelect={(accountId) => setSelectedAccountId((current) => (current === accountId ? null : accountId))}
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
          </Surface>
        </aside>

        <section className="h-full overflow-auto space-y-4 pr-1">
          <Surface tone="panel" padding="lg" className="flex flex-col gap-3">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-[22px] font-medium text-slate-900">
                    {selectedAccount ? selectedAccount.name : "All transactions"}
                  </h1>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {selectedAccount
                      ? savingsMode
                        ? "Filtered to one savings wallet. Subgroups stay in the left list."
                        : `${getAccountTypeLabel(selectedAccount.type)} wallet activity.`
                      : "Default register across every wallet in the workspace."}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[12px] text-slate-500">
              {selectedCreatedAt ? (
                <div className="flex items-center gap-2">
                  <CalendarRange className="h-4 w-4" />
                  {new Date(selectedCreatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
              ) : null}
              {selectedAccount ? (
                <div className="flex items-center gap-2">
                  <span>{getAccountTypeLabel(selectedAccount.type)}</span>
                  <MoneyAmount
                    amount={selectedBalance}
                    currency={selectedAccount.currency}
                    display={isDebtAccount(selectedAccount) ? "signed" : "absolute"}
                    className="text-[13px] font-semibold text-slate-700"
                  />
                </div>
              ) : (
                <span>{transactions.length} transactions across all wallets</span>
              )}
              {selectedAccount && savingsMode ? (
                <span>
                  {accountAllocations.length} subgroups,{" "}
                  <MoneyAmount
                    amount={getAllocatedTotalForAccount(allocations, selectedAccount.id)}
                    currency={selectedAccount.currency}
                    display="absolute"
                    className="text-[13px] font-semibold text-slate-700"
                  />{" "}
                  allocated
                </span>
              ) : null}
            </div>
          </Surface>

          <div className="space-y-3">
            <p className="text-[13px] font-medium text-slate-700">
              {selectedAccount ? "Filtered transaction register" : "Full transaction register"}
            </p>
            <TransactionList
              transactions={register}
              emptyMessage={selectedAccount ? "No transactions for this wallet." : "No transactions yet."}
              compact
            />
          </div>
        </section>
      </div>

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
