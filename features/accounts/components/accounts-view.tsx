"use client";

import { useMemo, useState } from "react";
import { CalendarRange, Ellipsis, Plus } from "lucide-react";

import { AccountList } from "@/components/account-list";
import { MoneyAmount } from "@/components/money-amount";
import { TransactionList } from "@/components/transaction-list";
import { Button } from "@/components/ui/button";
import { isSavingsAccount } from "@/features/accounts/lib/account-utils";
import { getAllocationsForAccount } from "@/features/allocations/lib/allocation-utils";
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
  "Summer trip": {
    accent: "bg-fuchsia-400",
    track: "bg-fuchsia-100",
    tags: ["Vacation", "Seasonal", "Family"],
  },
  "Pet expenses": {
    accent: "bg-violet-400",
    track: "bg-violet-100",
    tags: ["Pet care", "Medical", "Reserve"],
  },
  "Yearly purchases": {
    accent: "bg-orange-400",
    track: "bg-orange-100",
    tags: ["Gear", "Annual", "Planned"],
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
  const initialAccountId = useMemo(
    () => accounts.find((account) => account.type === "savings")?.id ?? accounts[0]?.id ?? "",
    [accounts],
  );
  const [selectedAccountId, setSelectedAccountId] = useState(initialAccountId);
  const selectedAccount = accounts.find((account) => account.id === selectedAccountId) ?? accounts.find((account) => account.id === initialAccountId) ?? accounts[0];
  const register = selectedAccount ? getTransactionsForAccount(transactions, selectedAccount.id).slice(0, 4) : [];
  const accountAllocations = selectedAccount ? getAllocationsForAccount(allocations, selectedAccount.id) : [];
  const savingsMode = selectedAccount ? isSavingsAccount(selectedAccount) : false;

  if (!selectedAccount) {
    return null;
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-[26px] bg-[#f3efeb] p-4">
        <div className="mb-5">
          <h2 className="text-[18px] font-medium text-slate-900">Organization Settings</h2>
        </div>
        <AccountList
          accounts={accounts}
          allocations={allocations}
          selectedAccountId={selectedAccount.id}
          onSelect={setSelectedAccountId}
        />
      </aside>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 rounded-[24px] bg-[#f7f3ef] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)]">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-[22px] font-medium text-slate-900">
                  {savingsMode ? "Budget" : selectedAccount.name}
                </h1>
                <p className="mt-1 text-[12px] text-slate-500">
                  {savingsMode
                    ? "Planned allocations inside the selected savings account."
                    : "Account overview and recent register activity."}
                </p>
              </div>
              <Button variant="outline" size="sm" className="rounded-xl bg-white">
                + Add Filters
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="rounded-xl bg-white">Export</Button>
              <Button size="sm" className="rounded-xl bg-emerald-600 text-white hover:bg-emerald-700">
                <Plus className="h-4 w-4" />
                Add Budget
              </Button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[12px] text-slate-500">
            <CalendarRange className="h-4 w-4" />
            Oct 1, 2023
            <span className="text-slate-300">-</span>
            Dec 31, 2024
          </div>
        </div>

        {savingsMode ? (
          <div className="space-y-4">
            {accountAllocations.map((allocation) => {
              const percent = selectedAccount.balance > 0 ? Math.round((allocation.amount / selectedAccount.balance) * 100) : 0;
              const remaining = Math.max(0, 100 - percent);
              const meta = allocationMeta[allocation.name] ?? {
                accent: "bg-emerald-500",
                track: "bg-emerald-100",
                tags: [selectedAccount.name, "Savings", "Planned"],
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
                    <Button variant="ghost" size="icon-sm" className="rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100">
                      <Ellipsis className="h-4 w-4" />
                    </Button>
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
                    <InfoRow label="Selected account" value={selectedAccount.name} />
                    <InfoRow label="Free money left" value={`${selectedAccount.currency} ${Math.max(0, selectedAccount.balance - allocation.amount).toLocaleString("en-US")}`} />
                    <InfoRow label="Created" value={new Date(allocation.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
                    <InfoRow label="Allocation share" value={`${percent}% of balance`} />
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
          </div>
        ) : (
          <article className="rounded-[24px] border border-white/70 bg-white px-5 py-5 shadow-[0_10px_30px_rgba(15,23,42,0.06)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <MoneyAmount
                  amount={selectedAccount.balance}
                  currency={selectedAccount.currency}
                  display="signed"
                  className="text-[34px] font-semibold text-slate-900"
                />
                <p className="mt-1 text-[15px] text-slate-700">{selectedAccount.name}</p>
              </div>
              <Button variant="ghost" size="icon-sm" className="rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100">
                <Ellipsis className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-6">
              <TransactionList transactions={register} emptyMessage="No transactions for this account." compact />
            </div>
          </article>
        )}

        {savingsMode && register.length ? (
          <div className="space-y-3">
            <p className="text-[13px] font-medium text-slate-700">Recent register activity</p>
            <TransactionList transactions={register} emptyMessage="No transactions for this account." compact />
          </div>
        ) : null}
      </section>
    </div>
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
