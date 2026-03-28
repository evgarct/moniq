import { AccountCard } from "@/components/account-card";
import { EmptyState } from "@/components/empty-state";
import type { Account, Allocation } from "@/types/finance";

export function AccountGroup({
  title,
  description,
  accounts,
  allocations,
  selectedAccountId,
  onSelect,
}: {
  title: string;
  description: string;
  accounts: Account[];
  allocations: Allocation[];
  selectedAccountId: string;
  onSelect: (accountId: string) => void;
}) {
  return (
    <section className="space-y-2">
      <div>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
        <p className="mt-1 text-[12px] text-slate-400">{description}</p>
      </div>

      {accounts.length ? (
        <div className="space-y-1.5">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              allocations={allocations}
              selected={account.id === selectedAccountId}
              onSelect={() => onSelect(account.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState title="No accounts yet" description="Add an account to start organizing money and liabilities." />
      )}
    </section>
  );
}
