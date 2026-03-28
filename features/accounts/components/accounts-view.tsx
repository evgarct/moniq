"use client";

import { useState } from "react";
import { CalendarRange, PencilLine, Plus, X } from "lucide-react";

import { AccountList } from "@/components/account-list";
import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { Surface } from "@/components/surface";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { AccountFormSheet } from "@/features/accounts/components/account-form-sheet";
import { deleteAccount, saveAccount } from "@/features/accounts/lib/account-state";
import { getAccountTypeLabel, isDebtAccount, isSavingsAccount } from "@/features/accounts/lib/account-utils";
import { AllocationFormSheet } from "@/features/allocations/components/allocation-form-sheet";
import {
  deleteAllocation,
  getAllocationsForAccount,
  getFreeMoney,
  saveAllocation,
} from "@/features/allocations/lib/allocation-utils";
import { getTransactionsForAccount } from "@/lib/finance-selectors";
import type { Account, Allocation, Transaction } from "@/types/finance";

export function AccountsView({
  accounts,
  allocations,
  transactions,
}: {
  accounts: Account[];
  allocations: Allocation[];
  transactions: Transaction[];
}) {
  const [draftAccounts, setDraftAccounts] = useState(accounts);
  const [draftAllocations, setDraftAllocations] = useState(allocations);
  const [draftTransactions, setDraftTransactions] = useState(transactions);
  const baseUserId = draftAccounts[0]?.user_id ?? accounts[0]?.user_id ?? "user-demo";
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [walletSheetMode, setWalletSheetMode] = useState<"add" | "edit">("add");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [draftWalletType, setDraftWalletType] = useState<Account["type"]>("cash");
  const [walletsEditMode, setWalletsEditMode] = useState(false);
  const [allocationSheetOpen, setAllocationSheetOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);

  const selectedAccount = selectedAccountId ? draftAccounts.find((account) => account.id === selectedAccountId) ?? null : null;

  const register = selectedAccount ? getTransactionsForAccount(draftTransactions, selectedAccount.id) : draftTransactions;
  const accountAllocations = selectedAccount ? getAllocationsForAccount(draftAllocations, selectedAccount.id) : [];
  const freeMoney = selectedAccount ? getFreeMoney(selectedAccount.balance, draftAllocations, selectedAccount.id) : 0;
  const savingsMode = selectedAccount ? isSavingsAccount(selectedAccount) : false;
  const selectedBalance = selectedAccount?.balance ?? 0;
  const selectedCreatedAt = selectedAccount?.created_at ?? null;

  if (!draftAccounts.length) {
    return (
      <EmptyState
        title="No wallets yet"
        description="Create your first wallet to start organizing cash, savings, cards, and debt."
        action={
          <Button
            onClick={() => {
              setWalletSheetMode("add");
              setEditingAccount(null);
              setWalletSheetOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            Add wallet
          </Button>
        }
      />
    );
  }

  function openAddWallet(type: Account["type"] = "cash") {
    setWalletSheetMode("add");
    setEditingAccount(null);
    setDraftWalletType(type);
    setWalletSheetOpen(true);
  }

  function openEditWallet(account: Account) {
    setWalletSheetMode("edit");
    setEditingAccount(account);
    setDraftWalletType(account.type);
    setWalletSheetOpen(true);
  }

  function handleSaveWallet(values: {
    name: string;
    type: Account["type"];
    balance: number;
    currency: string;
    debt_kind?: Account["debt_kind"];
  }) {
    const result = saveAccount({
      snapshot: {
        accounts: draftAccounts,
        allocations: draftAllocations,
        transactions: draftTransactions,
      },
      values,
      userId: baseUserId,
      mode: walletSheetMode,
      editingAccount,
    });

    setDraftAccounts(result.snapshot.accounts);
    setDraftAllocations(result.snapshot.allocations);
    setDraftTransactions(result.snapshot.transactions);
    setSelectedAccountId(result.account.id);
  }

  function handleDeleteWallet(account: Account) {
    if (!account) {
      return;
    }

    if (!window.confirm(`Delete wallet "${account.name}"?`)) {
      return;
    }

    const nextSnapshot = deleteAccount(
      {
        accounts: draftAccounts,
        allocations: draftAllocations,
        transactions: draftTransactions,
      },
      account.id,
    );
    setDraftAccounts(nextSnapshot.accounts);
    setDraftAllocations(nextSnapshot.allocations);
    setDraftTransactions(nextSnapshot.transactions);
    setSelectedAccountId((current) => (current === account.id ? null : current));
  }

  function openAddSubgroup() {
    setEditingAllocation(null);
    setAllocationSheetOpen(true);
  }

  function handleSaveAllocation(values: { name: string; amount: number }) {
    if (!selectedAccount) {
      return;
    }

    try {
      setDraftAllocations((current) =>
        saveAllocation({
          allocations: current,
          account: selectedAccount,
          values,
          editingAllocation,
        }),
      );
    } catch (error) {
      if (error instanceof Error) {
        window.alert(error.message);
        return;
      }

      throw error;
    }
  }

  function handleDeleteAllocation(allocation: Allocation) {
    if (!window.confirm(`Delete subgroup "${allocation.name}"?`)) {
      return;
    }

    setDraftAllocations((current) => deleteAllocation(current, allocation.id));
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
            <AccountList
              accounts={draftAccounts}
              allocations={draftAllocations}
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
                <span>{draftTransactions.length} transactions across all wallets</span>
              )}
              {selectedAccount && savingsMode ? (
                <span>{accountAllocations.length} subgroups in left rail</span>
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
