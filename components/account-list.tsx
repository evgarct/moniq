import { AccountGroup } from "@/components/account-group";
import { getAvailableMoneyAccounts, getDebtAccounts } from "@/lib/finance-selectors";
import type { Account, Allocation } from "@/types/finance";

export function AccountList({
  accounts,
  allocations,
  selectedAccountId,
  onSelect,
}: {
  accounts: Account[];
  allocations: Allocation[];
  selectedAccountId: string;
  onSelect: (accountId: string) => void;
}) {
  const availableMoneyAccounts = getAvailableMoneyAccounts(accounts);
  const debtAccounts = getDebtAccounts(accounts);

  return (
    <div className="space-y-5">
      <AccountGroup
        title="Available Money"
        description="Real balances you can spend or reserve."
        accounts={availableMoneyAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        onSelect={onSelect}
      />
      <AccountGroup
        title="Debts"
        description="Liabilities tracked separately from available cash."
        accounts={debtAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        onSelect={onSelect}
      />
    </div>
  );
}
