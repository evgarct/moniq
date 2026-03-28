"use client";

import { useState } from "react";

import { AccountList } from "@/components/account-list";
import { SectionCard } from "@/components/section-card";
import { TransactionList } from "@/components/transaction-list";
import { getTransactionsForAccount } from "@/lib/finance-selectors";
import type { Account, Transaction } from "@/types/finance";

export function AccountsView({
  accounts,
  transactions,
}: {
  accounts: Account[];
  transactions: Transaction[];
}) {
  const [selectedAccountId, setSelectedAccountId] = useState(accounts[0]?.id ?? "");
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts[0];
  const register = selectedAccount ? getTransactionsForAccount(transactions, selectedAccount.id) : [];

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <SectionCard title="Accounts" description="Core account surfaces for the first iteration.">
        <AccountList
          accounts={accounts}
          selectedAccountId={selectedAccountId}
          onSelect={setSelectedAccountId}
        />
      </SectionCard>

      <SectionCard
        title={selectedAccount ? `${selectedAccount.name} register` : "Register"}
        description="A simple register-style list for the selected account."
      >
        <TransactionList transactions={register} emptyMessage="No transactions for this account." />
      </SectionCard>
    </div>
  );
}
