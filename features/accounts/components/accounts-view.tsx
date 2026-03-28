"use client";

import { useEffect, useMemo, useState } from "react";
import { Ellipsis, Plus, SlidersHorizontal } from "lucide-react";

import { EmptyState } from "@/components/empty-state";
import { AccountList } from "@/components/account-list";
import { MoneyAmount } from "@/components/money-amount";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { isSavingsAccount } from "@/features/accounts/lib/account-utils";
import { AllocationFormSheet } from "@/features/allocations/components/allocation-form-sheet";
import { AllocationList } from "@/features/allocations/components/allocation-list";
import { FreeMoneyCard } from "@/features/allocations/components/free-money-card";
import { RebalancePanel } from "@/features/allocations/components/rebalance-panel";
import { SavingsSummaryCard } from "@/features/allocations/components/savings-summary-card";
import {
  getAllocatedTotalForAccount,
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
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const [draftAllocations, setDraftAllocations] = useState(allocations);
  const [rebalanceOpen, setRebalanceOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingAllocation, setEditingAllocation] = useState<Allocation | null>(null);

  useEffect(() => {
    setDraftAllocations(allocations);
  }, [allocations]);

  useEffect(() => {
    if (!selectedAccountId && accounts[0]) {
      setSelectedAccountId(accounts[0].id);
    }
  }, [accounts, selectedAccountId]);

  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];
  const register = selectedAccount ? getTransactionsForAccount(transactions, selectedAccount.id) : [];
  const accountAllocations = useMemo(
    () => (selectedAccount ? getAllocationsForAccount(draftAllocations, selectedAccount.id) : []),
    [draftAllocations, selectedAccount],
  );
  const allocatedTotal = selectedAccount ? getAllocatedTotalForAccount(draftAllocations, selectedAccount.id) : 0;
  const freeMoney = selectedAccount ? getFreeMoney(selectedAccount.balance, draftAllocations, selectedAccount.id) : 0;
  const savingsDetail = selectedAccount ? isSavingsAccount(selectedAccount) : false;

  const sortedAllocations = useMemo(
    () => [...accountAllocations].sort((left, right) => right.amount - left.amount),
    [accountAllocations],
  );

  function openAddAllocation() {
    setEditingAllocation(null);
    setFormOpen(true);
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

  function handleOpenEdit(allocation: Allocation) {
    setEditingAllocation(allocation);
    setFormOpen(true);
  }

  function handleRebalance(updatedAllocations: Allocation[]) {
    setDraftAllocations((current) =>
      current.map((allocation) => updatedAllocations.find((candidate) => candidate.id === allocation.id) ?? allocation),
    );
  }

  if (!selectedAccount) {
    return (
      <EmptyState
        title="No accounts available"
        description="Add mock accounts to review balances, debts, and savings allocations."
      />
    );
  }

  return (
    <>
      <div className="grid min-h-[calc(100vh-52px)] gap-0 xl:grid-cols-[minmax(320px,49%)_minmax(380px,1fr)]">
        <section className="border-r border-white/12 px-4 py-3 sm:px-5">
          <AccountList
            accounts={accounts}
            allocations={draftAllocations}
            selectedAccountId={selectedAccount.id}
            onSelect={setSelectedAccountId}
          />
        </section>

        <section className="px-4 py-3 sm:px-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <div className="min-w-[176px] rounded-[4px] bg-white/14 px-4 py-2 text-center text-[14px] font-medium text-slate-100">
                Oct 1, 2023
              </div>
              <div className="min-w-[176px] rounded-[4px] bg-white/14 px-4 py-2 text-center text-[14px] font-medium text-slate-100">
                Oct 31, 2023
              </div>
              <Button variant="ghost" size="icon-sm" className="rounded-[4px] bg-white/14 text-slate-100 hover:bg-white/18 hover:text-white">
                <Ellipsis className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </div>

            <div className="border-t border-white/20 pt-3">
              <div className="flex items-start justify-between gap-4 border-b border-white/18 pb-3">
                <div>
                  <h2 className="text-[17px] font-semibold text-white">{selectedAccount.name}</h2>
                  <p className="mt-1 text-[12px] text-slate-300/80">
                    {savingsDetail
                      ? "Savings allocations rebalance reserved money only."
                      : "Real balance view for the selected account."}
                  </p>
                </div>
                {savingsDetail ? (
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" className="text-slate-200 hover:bg-white/5 hover:text-white" onClick={openAddAllocation}>
                      <Plus className="h-3.5 w-3.5" />
                      Add allocation
                    </Button>
                    <Button type="button" size="sm" className="bg-white/14 text-slate-100 hover:bg-white/20" onClick={() => setRebalanceOpen(true)}>
                      <SlidersHorizontal className="h-3.5 w-3.5" />
                      Rebalance
                    </Button>
                  </div>
                ) : (
                  <MoneyAmount
                    amount={selectedAccount.balance}
                    currency={selectedAccount.currency}
                    display="signed"
                    tone={selectedAccount.balance < 0 ? "negative" : "default"}
                    className="text-[28px] font-semibold"
                  />
                )}
              </div>

              {savingsDetail ? (
                <div className="space-y-1">
                  <SavingsSummaryCard
                    balance={selectedAccount.balance}
                    allocated={allocatedTotal}
                    freeMoney={freeMoney}
                    currency={selectedAccount.currency}
                  />
                  <FreeMoneyCard amount={freeMoney} currency={selectedAccount.currency} />
                </div>
              ) : (
                <div className="grid gap-0 border-b border-white/18 py-2.5 md:grid-cols-3">
                  <MetricBlock label="Current balance" value={selectedAccount.balance} currency={selectedAccount.currency} />
                  <MetricBlock label="Account type" text={selectedAccount.type.replace("_", " ")} />
                  <MetricBlock label="Currency" text={selectedAccount.currency} />
                </div>
              )}
            </div>

            {savingsDetail ? (
              <div className="pt-2">
                <p className="pb-2 text-[10px] uppercase tracking-[0.14em] text-slate-300/80">Allocations</p>
                <AllocationList
                  allocations={sortedAllocations}
                  currency={selectedAccount.currency}
                  onEdit={handleOpenEdit}
                />
              </div>
            ) : null}

            <div className="pt-2">
              <p className="pb-2 text-[10px] uppercase tracking-[0.14em] text-slate-300/80">Account register</p>
              <TransactionList
                transactions={register}
                emptyMessage={savingsDetail ? "No transactions for this savings account." : "No transactions for this account."}
              />
            </div>
          </div>
        </section>
      </div>

      {selectedAccount.type === "savings" ? (
        <>
          <AllocationFormSheet
            open={formOpen}
            mode={editingAllocation ? "edit" : "add"}
            allocation={editingAllocation}
            currency={selectedAccount.currency}
            freeMoney={freeMoney}
            onOpenChange={setFormOpen}
            onSubmit={handleSaveAllocation}
          />
          <RebalancePanel
            open={rebalanceOpen}
            accountName={selectedAccount.name}
            balance={selectedAccount.balance}
            currency={selectedAccount.currency}
            allocations={sortedAllocations}
            onOpenChange={setRebalanceOpen}
            onSubmit={handleRebalance}
          />
        </>
      ) : null}
    </>
  );
}

function MetricBlock({
  label,
  value,
  currency,
  text,
}: {
  label: string;
  value?: number;
  currency?: string;
  text?: string;
}) {
  return (
    <div className="space-y-1 border-r border-white/18 pr-4 last:border-r-0 last:pr-0 sm:px-4 sm:first:pl-0 sm:last:pr-0">
      <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300/80">{label}</p>
      {typeof value === "number" && currency ? (
        <MoneyAmount amount={value} currency={currency} display="signed" className="text-[21px] font-semibold" />
      ) : (
        <p className="text-[21px] font-semibold capitalize text-white">{text}</p>
      )}
    </div>
  );
}
