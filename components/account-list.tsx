import { AccountGroup } from "@/components/account-group";
import {
  getCashAccounts,
  getCreditCardAccounts,
  getDebtAccounts,
  getSavingAccounts,
} from "@/lib/finance-selectors";
import type { Account, Allocation } from "@/types/finance";

export function AccountList({
  accounts,
  allocations,
  selectedAccountId,
  onSelect,
  onEditAllocation,
  onDeleteAllocation,
}: {
  accounts: Account[];
  allocations: Allocation[];
  selectedAccountId: string | null;
  onSelect: (accountId: string) => void;
  onEditAllocation?: (allocation: Allocation) => void;
  onDeleteAllocation?: (allocation: Allocation) => void;
}) {
  const cashAccounts = getCashAccounts(accounts);
  const savingAccounts = getSavingAccounts(accounts);
  const creditCardAccounts = getCreditCardAccounts(accounts);
  const debtAccounts = getDebtAccounts(accounts);

  return (
    <div className="space-y-6">
      <AccountGroup
        title="Cash"
        accounts={cashAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        onSelect={onSelect}
      />
      <AccountGroup
        title="Savings"
        accounts={savingAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        onSelect={onSelect}
        onEditAllocation={onEditAllocation}
        onDeleteAllocation={onDeleteAllocation}
      />
      <AccountGroup
        title="Credit Cards"
        accounts={creditCardAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        onSelect={onSelect}
      />
      <AccountGroup
        title="Debt"
        accounts={debtAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        onSelect={onSelect}
      />
    </div>
  );
}
