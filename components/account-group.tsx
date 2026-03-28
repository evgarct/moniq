import { AccountRow } from "@/components/account-row";
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
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);

  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between rounded-sm bg-slate-200/85 px-3 py-1.5">
        <div>
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-700">{title}</h3>
          <p className="mt-0.5 text-[11px] text-slate-500">{description}</p>
        </div>
        <span className="font-mono text-[16px] font-semibold tabular-nums text-slate-700">
          {Intl.NumberFormat("en-US", {
            style: "currency",
            currency: accounts[0]?.currency ?? "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(total)}
        </span>
      </div>

      {accounts.length ? (
        <div className="border-t border-border/70">
          {accounts.map((account) => (
            <AccountRow
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
