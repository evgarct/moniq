"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { PencilLine, Plus, X } from "lucide-react";

import { AccountList } from "@/components/account-list";
import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { AccountFormSheet } from "@/features/accounts/components/account-form-sheet";
import { isDebtAccount, isSavingsAccount } from "@/features/accounts/lib/account-utils";
import { AllocationFormSheet } from "@/features/allocations/components/allocation-form-sheet";
import {
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
  const freeMoney = selectedAccount ? getFreeMoney(selectedAccount.balance, allocations, selectedAccount.id) : 0;
  const selectedBalance = selectedAccount?.balance ?? 0;
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
      {accounts.length ? (
        <div className="mx-auto max-w-7xl grid h-full gap-12 lg:grid-cols-[400px_minmax(0,1fr)] px-4 lg:px-8 py-8 lg:py-12">
          <aside className="h-full overflow-auto pr-4 lg:pr-8 lg:border-r border-border/60">
            <div className="mb-8 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h1 className="text-[28px] text-slate-900 font-heading font-normal">Accounts & Wallets</h1>
                <Button
                  variant={walletsEditMode ? "default" : "ghost"}
                  size="icon-sm"
                  className="rounded-lg ml-2"
                  onClick={() => setWalletsEditMode((current) => !current)}
                  title={walletsEditMode ? "Finish editing wallets" : "Edit wallets"}
                  aria-label={walletsEditMode ? "Finish editing wallets" : "Edit wallets"}
                >
                  <PencilLine className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center gap-2">
                {selectedAccount ? (
                  <Button
                    variant="outline"
                    size="icon-sm"
                    className="rounded-xl bg-white shadow-sm"
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
              <div className="mb-6 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700">
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
          </aside>

          <section className="h-full overflow-auto space-y-6 lg:pl-8">
            <div className="rounded-[40px] bg-white shadow-sm ring-1 ring-black/5 p-6 lg:p-10 min-h-full flex flex-col">
              <div className="mb-12 flex items-start justify-between gap-6">
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface/80 text-2xl shadow-sm border border-black/5">
                      {selectedAccount ? (
                         isSavingsAccount(selectedAccount) ? "💰" : isDebtAccount(selectedAccount) ? "🏦" : "💳"
                      ) : "📊"}
                    </div>
                    <h1 className="text-[28px] font-heading font-normal text-slate-900 leading-tight">
                      {selectedAccount ? selectedAccount.name : "Overview"}
                    </h1>
                  </div>
                  <div>
                    <p className="text-[13px] font-medium uppercase tracking-[0.1em] text-slate-400 mb-1">
                      {selectedAccount ? "Total Balance" : "Activity summary"}
                    </p>
                    {selectedAccount ? (
                      <MoneyAmount
                        amount={selectedBalance}
                        currency={selectedAccount.currency}
                        display={isDebtAccount(selectedAccount) ? "signed" : "absolute"}
                        className="text-[48px] font-heading font-normal tracking-tight text-slate-900"
                      />
                    ) : (
                      <span className="text-[32px] font-heading font-normal tracking-tight text-slate-900">
                        {transactions.length} transactions
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden sm:flex items-center gap-3">
                  <Button variant="outline" className="rounded-xl bg-white shadow-sm h-11 px-6 font-medium text-slate-700">
                    Send
                  </Button>
                  <Button className="rounded-xl bg-slate-900 text-white shadow-md h-11 px-6 font-medium hover:bg-slate-800">
                    Add Money
                  </Button>
                </div>
              </div>

              {selectedAccount && !isDebtAccount(selectedAccount) ? (
                <div className="mb-12">
                  <div className="h-[180px] w-full rounded-2xl bg-surface/50 border border-black/5 flex items-end px-6 pb-6 pt-12 relative overflow-hidden">
                    <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-surface/80 to-transparent flex items-end justify-around pb-4">
                      {/* Decorative bar chart placeholder */}
                      <div className="w-12 h-[40%] rounded-t-lg bg-slate-200/50" />
                      <div className="w-12 h-[60%] rounded-t-lg bg-slate-200/50" />
                      <div className="w-12 h-[30%] rounded-t-lg bg-slate-200/50" />
                      <div className="w-12 h-[80%] rounded-t-lg bg-slate-800/80 shadow-md" />
                      <div className="w-12 h-[50%] rounded-t-lg bg-slate-200/50" />
                      <div className="w-12 h-[70%] rounded-t-lg bg-slate-200/50" />
                    </div>
                    <span className="text-slate-400 text-sm italic relative z-10 w-full text-center mt-auto pb-2">
                       Insight Chart
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="flex-1">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-[20px] font-heading font-normal text-slate-800">
                    Activity
                  </h3>
                  <Button variant="ghost" className="text-sm font-medium text-slate-500 hover:text-slate-900">
                    View All
                  </Button>
                </div>
                
                <div className="-mx-2">
                  <TransactionList
                    transactions={register}
                    emptyMessage={selectedAccount ? "No transactions for this wallet yet.\nTransactions will appear here once they occur." : "No transactions yet."}
                    compact
                  />
                </div>
              </div>
            </div>
          </section>
        </div>
      ) : (
        <EmptyState
          title="No wallets yet"
          description="Create your first wallet to start organizing real balances in Supabase."
          action={emptyAction}
        />
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
