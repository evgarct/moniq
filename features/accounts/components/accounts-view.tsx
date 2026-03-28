"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Ellipsis, PencilLine, Plus, Trash2 } from "lucide-react";

import { AccountList } from "@/components/account-list";
import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { AccountFormSheet } from "@/features/accounts/components/account-form-sheet";
import { getAccountTypeLabel, isDebtAccount, isSavingsAccount } from "@/features/accounts/lib/account-utils";
import { AllocationFormSheet } from "@/features/allocations/components/allocation-form-sheet";
import { AllocationList } from "@/features/allocations/components/allocation-list";
import {
  getAllocatedTotalForAccount,
  getAllocationsForAccount,
  getFreeMoney,
} from "@/features/allocations/lib/allocation-utils";
import { getTransactionsForAccount } from "@/lib/finance-selectors";
import { cn } from "@/lib/utils";
import type { Account, Allocation, Transaction } from "@/types/finance";

const allocationMeta: Record<string, { accent: string; track: string; tags: string[] }> = {
  "Rent buffer": {
    accent: "bg-emerald-500",
    track: "bg-emerald-100",
    tags: ["Housing", "Monthly reserve", "Cash flow"],
  },
  Travel: {
    accent: "bg-amber-400",
    track: "bg-amber-100",
    tags: ["Flights", "Hotels", "Leisure"],
  },
  "Emergency fund": {
    accent: "bg-sky-500",
    track: "bg-sky-100",
    tags: ["Safety net", "Unexpected costs", "Priority"],
  },
  Uncategorized: {
    accent: "bg-slate-400",
    track: "bg-slate-200",
    tags: ["System group", "Direct withdrawals", "No category"],
  },
};

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
  const initialAccountId = useMemo(
    () => draftAccounts.find((account) => account.type === "saving")?.id ?? draftAccounts[0]?.id ?? "",
    [draftAccounts],
  );
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId);
  const [walletSheetOpen, setWalletSheetOpen] = useState(false);
  const [walletSheetMode, setWalletSheetMode] = useState<"add" | "edit">("add");
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [allocationSheetOpen, setAllocationSheetOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);

  const selectedAccount =
    draftAccounts.find((account) => account.id === selectedAccountId) ??
    draftAccounts.find((account) => account.id === initialAccountId) ??
    draftAccounts[0];

  const register = selectedAccount ? getTransactionsForAccount(draftTransactions, selectedAccount.id).slice(0, 4) : [];
  const accountAllocations = selectedAccount ? getAllocationsForAccount(draftAllocations, selectedAccount.id) : [];
  const freeMoney = selectedAccount ? getFreeMoney(selectedAccount.balance, draftAllocations, selectedAccount.id) : 0;
  const savingsMode = selectedAccount ? isSavingsAccount(selectedAccount) : false;
  const savingsCards = selectedAccount && savingsMode
    ? [
        {
          id: `uncategorized-${selectedAccount.id}`,
          name: "Uncategorized",
          amount: Math.max(0, freeMoney),
          created_at: selectedAccount.created_at,
          account_id: selectedAccount.id,
          user_id: selectedAccount.user_id,
          system: true,
        },
        ...accountAllocations.map((allocation) => ({ ...allocation, system: false })),
      ]
    : [];

  if (!selectedAccount) {
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
      user_id: selectedAccount.user_id,
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
    setSelectedAccountId(remainingAccounts[0]?.id ?? "");
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
      <div className="grid h-full gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-full overflow-auto rounded-[26px] bg-[#f3efeb] p-4">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <h2 className="text-[18px] font-medium text-slate-900">Wallets</h2>
              <p className="mt-1 text-[12px] text-slate-500">Cash, saving, cards, and debt.</p>
            </div>
            <Button size="sm" className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700" onClick={openAddWallet}>
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          <AccountList
            accounts={draftAccounts}
            allocations={draftAllocations}
            selectedAccountId={selectedAccount.id}
            onSelect={setSelectedAccountId}
          />
        </aside>

        <section className="h-full overflow-auto space-y-4 pr-1">
          <div className="flex flex-col gap-3 rounded-[24px] bg-[#f7f3ef] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <h1 className="text-[22px] font-medium text-slate-900">{selectedAccount.name}</h1>
                  <p className="mt-1 text-[12px] text-slate-500">
                    {savingsMode
                      ? "Savings money is stored on one wallet and split into logical subgroups."
                      : `${getAccountTypeLabel(selectedAccount.type)} wallet overview.`}
                  </p>
                </div>
                <Button variant="outline" size="sm" className="rounded-xl bg-white">
                  {getAccountTypeLabel(selectedAccount.type)}
                </Button>
              </div>

              <div className="flex items-center gap-2">
                {savingsMode ? (
                  <Button variant="outline" size="sm" className="rounded-xl bg-white" onClick={openAddSubgroup}>
                    <Plus className="h-4 w-4" />
                    Add subgroup
                  </Button>
                ) : null}
                <Button variant="outline" size="sm" className="rounded-xl bg-white" onClick={openEditWallet}>
                  <PencilLine className="h-4 w-4" />
                  Edit wallet
                </Button>
                <Button variant="outline" size="sm" className="rounded-xl bg-white text-destructive hover:bg-destructive/5" onClick={handleDeleteWallet}>
                  <Trash2 className="h-4 w-4" />
                  Delete wallet
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[12px] text-slate-500">
              <CalendarRange className="h-4 w-4" />
              {new Date(selectedAccount.created_at).toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </div>
          </div>

          {savingsMode ? (
            <div className="space-y-4">
              {savingsCards.map((allocation) => {
                const percent = selectedAccount.balance > 0 ? Math.round((allocation.amount / selectedAccount.balance) * 100) : 0;
                const remaining = Math.max(0, 100 - percent);
                const meta = allocationMeta[allocation.name] ?? {
                  accent: "bg-emerald-500",
                  track: "bg-emerald-100",
                  tags: allocation.system
                    ? ["System group", "Direct withdrawals", "No category"]
                    : [selectedAccount.name, "Saving subgroup", "Planned"],
                };

                return (
                  <article
                    key={allocation.id}
                    className="rounded-[24px] border border-white/70 bg-white px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <MoneyAmount
                          amount={allocation.amount}
                          currency={selectedAccount.currency}
                          display="absolute"
                          className="text-[34px] font-semibold text-slate-900"
                        />
                        <p className="mt-1 text-[15px] text-slate-700">{allocation.name}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {!allocation.system ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"
                            onClick={() => {
                              setEditingAllocation(allocation);
                              setAllocationSheetOpen(true);
                            }}
                          >
                            <PencilLine className="h-4 w-4" />
                          </Button>
                        ) : null}
                        {!allocation.system ? (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100"
                            onClick={() => handleDeleteAllocation(allocation)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        ) : (
                          <Button variant="ghost" size="icon-sm" className="rounded-xl bg-slate-50 text-slate-400 hover:bg-slate-100">
                            <Ellipsis className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="mt-5">
                      <div className={cn("h-1.5 w-full overflow-hidden rounded-full", meta.track)}>
                        <div className={cn("h-full rounded-full", meta.accent)} style={{ width: `${Math.min(percent, 100)}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[11px] font-medium">
                        <span className="text-emerald-600">{percent}%</span>
                        <span className="text-amber-500">{remaining}%</span>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 text-[12px] text-slate-500 sm:grid-cols-2">
                      <InfoRow label="Wallet" value={selectedAccount.name} />
                      <InfoRow
                        label={allocation.system ? "Available without subgroup" : "Available after subgroup"}
                        value={`${selectedAccount.currency} ${Math.max(0, selectedAccount.balance - allocation.amount).toLocaleString("en-US")}`}
                      />
                      <InfoRow
                        label="Created"
                        value={new Date(allocation.created_at).toLocaleDateString("en-US", {
                          month: "long",
                          day: "numeric",
                          year: "numeric",
                        })}
                      />
                      <InfoRow label="Share of savings" value={`${percent}% of wallet`} />
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {meta.tags.map((tag) => (
                        <span key={`${allocation.id}-${tag}`} className="rounded-full bg-[#f3efeb] px-2.5 py-1 text-[11px] text-slate-600">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })}

              <div className="space-y-3">
                <p className="text-[13px] font-medium text-slate-700">Subgroup list</p>
                <AllocationList
                  allocations={accountAllocations}
                  currency={selectedAccount.currency}
                  onEdit={(allocation) => {
                    setEditingAllocation(allocation);
                    setAllocationSheetOpen(true);
                  }}
                  onDelete={handleDeleteAllocation}
                />
              </div>
            </div>
          ) : (
            <article className="rounded-[24px] border border-white/70 bg-white px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <MoneyAmount
                    amount={selectedAccount.balance}
                    currency={selectedAccount.currency}
                    display={isDebtAccount(selectedAccount) ? "signed" : "absolute"}
                    className="text-[34px] font-semibold text-slate-900"
                  />
                  <p className="mt-1 text-[15px] text-slate-700">{selectedAccount.name}</p>
                </div>
                <Button variant="ghost" size="icon-sm" className="rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100">
                  <Ellipsis className="h-4 w-4" />
                </Button>
              </div>
              <div className="mt-5 grid gap-3 text-[12px] text-slate-500 sm:grid-cols-2">
                <InfoRow label="Wallet type" value={getAccountTypeLabel(selectedAccount.type)} />
                <InfoRow label="Currency" value={selectedAccount.currency} />
                <InfoRow label="Spending" value={selectedAccount.type === "cash" || selectedAccount.type === "credit_card" ? "Directly from wallet" : "No direct spending"} />
                <InfoRow label="Model note" value={selectedAccount.type === "debt" ? "Specification only for now" : "Operational wallet"} />
              </div>
            </article>
          )}

          <div className="space-y-3">
            <p className="text-[13px] font-medium text-slate-700">Recent register activity</p>
            <TransactionList transactions={register} emptyMessage="No transactions for this account." compact />
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

      {selectedAccount.type === "saving" ? (
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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="text-right text-slate-700">{value}</span>
    </div>
  );
}
