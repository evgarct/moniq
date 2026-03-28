"use client";

import { useState } from "react";
import { CalendarRange, Ellipsis, PencilLine, Plus, Trash2, X } from "lucide-react";

import { AccountList } from "@/components/account-list";
import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { AccountFormSheet } from "@/features/accounts/components/account-form-sheet";
import { getAccountTypeLabel, isDebtAccount, isSavingsAccount } from "@/features/accounts/lib/account-utils";
import { AllocationFormSheet } from "@/features/allocations/components/allocation-form-sheet";
import {
  getAllocationsForAccount,
  getFreeMoney,
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

  function openAddWallet() {
    setWalletSheetMode("add");
    setEditingAccount(null);
    setWalletSheetOpen(true);
  }

  function openEditWallet() {
    setWalletSheetMode("edit");
    setEditingAccount(selectedAccount);
    setWalletSheetOpen(true);
  }

  function handleSaveWallet(values: {
    name: string;
    type: Account["type"];
    balance: number;
    currency: string;
    debt_kind?: Account["debt_kind"];
  }) {
    const normalizedBalance =
      values.type === "credit_card" || values.type === "debt"
        ? -Math.abs(values.balance)
        : Math.abs(values.balance);

    if (walletSheetMode === "edit" && editingAccount) {
      const nextAccount: Account = {
        ...editingAccount,
        name: values.name,
        type: values.type,
        balance: normalizedBalance,
        currency: values.currency,
        debt_kind: values.type === "debt" ? values.debt_kind ?? "personal" : null,
        cash_kind: values.type === "cash" ? editingAccount.cash_kind ?? "debit_card" : null,
      };

      setDraftAccounts((current) => current.map((account) => (account.id === nextAccount.id ? nextAccount : account)));
      if (editingAccount.type === "saving" && values.type !== "saving") {
        setDraftAllocations((current) => current.filter((allocation) => allocation.account_id !== nextAccount.id));
      }
      setDraftTransactions((current) =>
        current.map((transaction) =>
          transaction.account.id === nextAccount.id ? { ...transaction, account: nextAccount } : transaction,
        ),
      );
      return;
    }

    const createdAccount: Account = {
      id: `wallet-${crypto.randomUUID()}`,
      user_id: baseUserId,
      name: values.name,
      type: values.type,
      balance: normalizedBalance,
      currency: values.currency,
      created_at: new Date().toISOString(),
      cash_kind: values.type === "cash" ? "debit_card" : null,
      debt_kind: values.type === "debt" ? values.debt_kind ?? "personal" : null,
    };

    setDraftAccounts((current) => [createdAccount, ...current]);
    setSelectedAccountId(createdAccount.id);
  }

  function handleDeleteWallet() {
    if (!selectedAccount) {
      return;
    }

    if (!window.confirm(`Delete wallet "${selectedAccount.name}"?`)) {
      return;
    }

    const remainingAccounts = draftAccounts.filter((account) => account.id !== selectedAccount.id);
    setDraftAccounts(remainingAccounts);
    setDraftAllocations((current) => current.filter((allocation) => allocation.account_id !== selectedAccount.id));
    setDraftTransactions((current) => current.filter((transaction) => transaction.account.id !== selectedAccount.id));
    setSelectedAccountId(null);
  }

  function openAddSubgroup() {
    setEditingAllocation(null);
    setAllocationSheetOpen(true);
  }

  function handleSaveAllocation(values: { name: string; amount: number }) {
    if (!selectedAccount) {
      return;
    }

    if (editingAllocation) {
      setDraftAllocations((current) =>
        current.map((allocation) =>
          allocation.id === editingAllocation.id
            ? {
                ...allocation,
                name: values.name,
                amount: values.amount,
              }
            : allocation,
        ),
      );
      return;
    }

    setDraftAllocations((current) => [
      ...current,
      {
        id: `allocation-${crypto.randomUUID()}`,
        user_id: selectedAccount.user_id,
        account_id: selectedAccount.id,
        name: values.name,
        amount: values.amount,
        created_at: new Date().toISOString(),
      },
    ]);
  }

  function handleDeleteAllocation(allocation: Allocation) {
    if (!window.confirm(`Delete subgroup "${allocation.name}"?`)) {
      return;
    }

    setDraftAllocations((current) => current.filter((candidate) => candidate.id !== allocation.id));
  }

  return (
    <>
      <div className="grid h-full gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        <aside className="h-full overflow-auto rounded-[26px] bg-[#f3efeb] p-4">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-medium text-slate-900">Wallets</h2>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="icon-sm"
                className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700"
                onClick={openAddWallet}
                title="Add wallet"
                aria-label="Add wallet"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="outline"
                      size="icon-sm"
                      className="rounded-xl bg-white"
                      aria-label="More account actions"
                    />
                  }
                >
                  <Ellipsis className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-44 rounded-xl bg-white p-1.5" align="end">
                  {savingsMode ? (
                    <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={openAddSubgroup}>
                      <Plus className="h-4 w-4" />
                      Add subgroup
                    </DropdownMenuItem>
                  ) : null}
                  {selectedAccount ? (
                    <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={openEditWallet}>
                      <PencilLine className="h-4 w-4" />
                      Edit wallet
                    </DropdownMenuItem>
                  ) : null}
                  {selectedAccount ? (
                    <DropdownMenuItem
                      className="rounded-lg px-2 py-2 text-[13px]"
                      variant="destructive"
                      onClick={handleDeleteWallet}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete wallet
                    </DropdownMenuItem>
                  ) : null}
                  {selectedAccount ? <DropdownMenuSeparator /> : null}
                  {selectedAccount ? (
                    <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={() => setSelectedAccountId(null)}>
                      <X className="h-4 w-4" />
                      Show all transactions
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <AccountList
            accounts={draftAccounts}
            allocations={draftAllocations}
            selectedAccountId={selectedAccountId}
            onSelect={(accountId) => setSelectedAccountId((current) => (current === accountId ? null : accountId))}
            onEditAllocation={(allocation) => {
              setSelectedAccountId(allocation.account_id);
              setEditingAllocation(allocation);
              setAllocationSheetOpen(true);
            }}
            onDeleteAllocation={handleDeleteAllocation}
          />
        </aside>

        <section className="h-full overflow-auto space-y-4 pr-1">
          <div className="flex flex-col gap-3 rounded-[24px] bg-[#f7f3ef] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
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
          </div>

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
