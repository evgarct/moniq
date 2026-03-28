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
  editing = false,
  onSelect,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onAddSubgroup,
  onEditAllocation,
  onDeleteAllocation,
}: {
  accounts: Account[];
  allocations: Allocation[];
  selectedAccountId: string | null;
  editing?: boolean;
  onSelect: (accountId: string) => void;
  onAddAccount?: (type: Account["type"]) => void;
  onEditAccount?: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void;
  onAddSubgroup?: (account: Account) => void;
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
        editing={editing}
        onSelect={onSelect}
        onAddAccount={onAddAccount ? () => onAddAccount("cash") : undefined}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
      />
      <AccountGroup
        title="Savings"
        accounts={savingAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        editing={editing}
        onSelect={onSelect}
        onAddAccount={onAddAccount ? () => onAddAccount("saving") : undefined}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
        onAddSubgroup={onAddSubgroup}
        onEditAllocation={onEditAllocation}
        onDeleteAllocation={onDeleteAllocation}
      />
      <AccountGroup
        title="Credit Cards"
        accounts={creditCardAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        editing={editing}
        onSelect={onSelect}
        onAddAccount={onAddAccount ? () => onAddAccount("credit_card") : undefined}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
      />
      <AccountGroup
        title="Debt"
        accounts={debtAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        editing={editing}
        onSelect={onSelect}
        onAddAccount={onAddAccount ? () => onAddAccount("debt") : undefined}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
      />
    </div>
  );
}
