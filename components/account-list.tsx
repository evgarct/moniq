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
}: {
  accounts: Account[];
  allocations: Allocation[];
  selectedAccountId: string;
  onSelect: (accountId: string) => void;
}) {
  const cashAccounts = getCashAccounts(accounts);
  const savingAccounts = getSavingAccounts(accounts);
  const creditCardAccounts = getCreditCardAccounts(accounts);
  const debtAccounts = getDebtAccounts(accounts);

  return (
    <div className="space-y-6">
      <AccountGroup
        title="Cash"
        description="Debit cards and cash wallets you can spend from directly."
        accounts={cashAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        onSelect={onSelect}
      />
      <AccountGroup
        title="Savings"
        description="Savings wallets hold money first, then split it into subgroups."
        accounts={savingAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        onSelect={onSelect}
      />
      <AccountGroup
        title="Credit Cards"
        description="Direct spend wallets with a card balance. Advanced handling comes later."
        accounts={creditCardAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        onSelect={onSelect}
      />
      <AccountGroup
        title="Debt"
        description="Loans, mortgages, and other debt balances tracked in the model."
        accounts={debtAccounts}
        allocations={allocations}
        selectedAccountId={selectedAccountId}
        onSelect={onSelect}
      />
    </div>
  );
}
