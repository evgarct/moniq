import { AccountRow } from "@/components/account-row";
import { EmptyState } from "@/components/empty-state";
import type { Account, Allocation } from "@/types/finance";

export function AccountGroup({
  title,
  accounts,
  allocations,
  selectedAccountId,
  onSelect,
}: {
  title: string;
  accounts: Account[];
  allocations: Allocation[];
  selectedAccountId: string;
  onSelect: (accountId: string) => void;
}) {
  const total = accounts.reduce((sum, account) => sum + account.balance, 0);

  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between rounded-[3px] bg-white/14 px-3 py-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-100">{title}</h3>
        <span className="font-mono text-[14px] font-semibold tabular-nums text-slate-100">
          {Intl.NumberFormat("en-US", {
            style: "currency",
            currency: accounts[0]?.currency ?? "USD",
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(total)}
        </span>
      </div>

      {accounts.length ? (
        <div className="border-t border-white/18">
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
