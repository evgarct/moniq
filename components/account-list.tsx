import { AccountCard } from "@/components/account-card";
import type { Account } from "@/types/finance";

export function AccountList({
  accounts,
  selectedAccountId,
  onSelect,
}: {
  accounts: Account[];
  selectedAccountId: string;
  onSelect: (accountId: string) => void;
}) {
  return (
    <div className="space-y-3">
      {accounts.map((account) => (
        <AccountCard
          key={account.id}
          account={account}
          selected={account.id === selectedAccountId}
          onSelect={() => onSelect(account.id)}
        />
      ))}
    </div>
  );
}
