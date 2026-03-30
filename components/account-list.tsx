import { useTranslations } from "next-intl";

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
  selectedAllocationId,
  editing = false,
  onSelect,
  onSelectAllocation,
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
  selectedAllocationId?: string | null;
  editing?: boolean;
  onSelect: (accountId: string) => void;
  onSelectAllocation?: (allocation: Allocation) => void;
  onAddAccount?: (type: Account["type"]) => void;
  onEditAccount?: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void;
  onAddSubgroup?: (account: Account) => void;
  onEditAllocation?: (allocation: Allocation) => void;
  onDeleteAllocation?: (allocation: Allocation) => void;
}) {
  const t = useTranslations("accounts.groups");
  const cashAccounts = getCashAccounts(accounts);
  const savingAccounts = getSavingAccounts(accounts);
  const creditCardAccounts = getCreditCardAccounts(accounts);
  const debtAccounts = getDebtAccounts(accounts);

  return (
    <div className="flex flex-col gap-5">
      <AccountGroup
        title={t("cash")}
        accounts={cashAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        selectedAllocationId={selectedAllocationId}
        editing={editing}
        onSelect={onSelect}
        onSelectAllocation={onSelectAllocation}
        onAddAccount={onAddAccount ? () => onAddAccount("cash") : undefined}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
      />
      <AccountGroup
        title={t("savings")}
        accounts={savingAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        selectedAllocationId={selectedAllocationId}
        editing={editing}
        onSelect={onSelect}
        onSelectAllocation={onSelectAllocation}
        onAddAccount={onAddAccount ? () => onAddAccount("saving") : undefined}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
        onAddSubgroup={onAddSubgroup}
        onEditAllocation={onEditAllocation}
        onDeleteAllocation={onDeleteAllocation}
      />
      <AccountGroup
        title={t("creditCards")}
        accounts={creditCardAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        selectedAllocationId={selectedAllocationId}
        editing={editing}
        onSelect={onSelect}
        onSelectAllocation={onSelectAllocation}
        onAddAccount={onAddAccount ? () => onAddAccount("credit_card") : undefined}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
      />
      <AccountGroup
        title={t("debt")}
        accounts={debtAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        selectedAllocationId={selectedAllocationId}
        editing={editing}
        onSelect={onSelect}
        onSelectAllocation={onSelectAllocation}
        onAddAccount={onAddAccount ? () => onAddAccount("debt") : undefined}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
      />
    </div>
  );
}
