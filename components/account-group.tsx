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
    <section className="space-y-3">
      <div>
        <h3 className="font-heading text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">{title}</h3>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </div>

      {accounts.length ? (
        <div className="space-y-3">
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
