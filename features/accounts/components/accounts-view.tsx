"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, SlidersHorizontal } from "lucide-react";

import { AccountTypeBadge } from "@/components/account-type-badge";
import { EmptyState } from "@/components/empty-state";
import { AccountList } from "@/components/account-list";
import { MoneyAmount } from "@/components/money-amount";
import { SectionCard } from "@/components/section-card";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { isSavingsAccount } from "@/features/accounts/lib/account-utils";
import { AllocationFormSheet } from "@/features/allocations/components/allocation-form-sheet";
import { AllocationList } from "@/features/allocations/components/allocation-list";
import { FreeMoneyCard } from "@/features/allocations/components/free-money-card";
import { RebalancePanel } from "@/features/allocations/components/rebalance-panel";
import { SavingsSummaryCard } from "@/features/allocations/components/savings-summary-card";
import { getAllocatedTotalForAccount, getAllocationsForAccount, getFreeMoney } from "@/features/allocations/lib/allocation-utils";
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
      <div className="grid gap-6 xl:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <SectionCard title="Accounts" description="Available money and liabilities in one ledger view.">
          <AccountList
            accounts={accounts}
            allocations={draftAllocations}
            selectedAccountId={selectedAccount.id}
            onSelect={setSelectedAccountId}
          />
        </SectionCard>

        {savingsDetail ? (
          <div className="space-y-4">
            <SectionCard
              title={selectedAccount.name}
              description="Allocations reserve money inside this savings account. Rebalancing changes reserved amounts only."
              action={
                <div className="flex gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={openAddAllocation}>
                    <Plus className="h-3.5 w-3.5" />
                    Add allocation
                  </Button>
                  <Button type="button" size="sm" onClick={() => setRebalanceOpen(true)}>
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    Rebalance allocations
                  </Button>
                </div>
              }
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <AccountTypeBadge type={selectedAccount.type} />
                    <p className="text-[12px] text-muted-foreground">{selectedAccount.currency} savings reserve</p>
                  </div>
                  <MoneyAmount amount={selectedAccount.balance} currency={selectedAccount.currency} display="absolute" className="text-[24px] font-semibold" />
                </div>
                <div className="space-y-1">
                  <SavingsSummaryCard
                    balance={selectedAccount.balance}
                    allocated={allocatedTotal}
                    freeMoney={freeMoney}
                    currency={selectedAccount.currency}
                  />
                  <FreeMoneyCard amount={freeMoney} currency={selectedAccount.currency} />
                </div>
              </div>
            </SectionCard>

            <SectionCard title="Allocations" description="Reserved money inside this savings account.">
              <AllocationList
                allocations={sortedAllocations}
                currency={selectedAccount.currency}
                onEdit={handleOpenEdit}
              />
            </SectionCard>

            <SectionCard title="Account register" description="Transactions belong to the real savings account, not to the allocations.">
              <TransactionList transactions={register} emptyMessage="No transactions for this savings account." />
            </SectionCard>
          </div>
        ) : (
          <div className="space-y-4">
            <SectionCard
              title={selectedAccount.name}
              description="Liabilities stay distinct from available money accounts."
            >
              <div className="grid gap-0 border-t border-border/70 py-2.5 md:grid-cols-3">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Current balance</p>
                  <MoneyAmount
                    amount={selectedAccount.balance}
                    currency={selectedAccount.currency}
                    display="signed"
                    tone={selectedAccount.balance < 0 ? "negative" : "default"}
                    className="mt-1 text-[22px] font-semibold"
                  />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Account type</p>
                  <div className="mt-1">
                    <AccountTypeBadge type={selectedAccount.type} />
                  </div>
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Notes</p>
                  <p className="mt-1 text-[12px] text-muted-foreground">
                    This is a real account balance, not a planned allocation bucket.
                  </p>
                </div>
              </div>
            </SectionCard>

            <SectionCard title={`${selectedAccount.name} register`} description="Simple register-style transaction history for the selected account.">
              <TransactionList transactions={register} emptyMessage="No transactions for this account." />
            </SectionCard>
          </div>
        )}
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
