import { useTranslations } from "next-intl";

import { AccountGroup } from "@/components/account-group";
import {
  getCashAccounts,
  getCreditCardAccounts,
  getDebtAccounts,
  getSavingAccounts,
} from "@/lib/finance-selectors";
import type { Account, WalletAllocation } from "@/types/finance";

export function AccountList({
  accounts,
  selectedAccountId,
  editing = false,
  showMinorUnits = true,
  onSelect,
  onAddAccount,
  onEditAccount,
  onDeleteAccount,
  onAdjustBalance,
  allocations,
  onAddGoal,
  onEditGoal,
  onDeleteGoal,
}: {
  accounts: Account[];
  selectedAccountId: string | null;
  editing?: boolean;
  showMinorUnits?: boolean;
  onSelect: (accountId: string) => void;
  onAddAccount?: (type: Account["type"]) => void;
  onEditAccount?: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void;
  onAdjustBalance?: (account: Account, newBalance: number) => void;
  allocations?: WalletAllocation[];
  onAddGoal?: (walletId: string) => void;
  onEditGoal?: (allocation: WalletAllocation) => void;
  onDeleteGoal?: (allocation: WalletAllocation) => void;
}) {
  const t = useTranslations("accounts.groups");
  const cashAccounts = getCashAccounts(accounts);
  const savingAccounts = getSavingAccounts(accounts);
  const creditCardAccounts = getCreditCardAccounts(accounts);
  const debtAccounts = getDebtAccounts(accounts);

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <AccountGroup
        title={t("cash")}
        accounts={cashAccounts}
        selectedAccountId={selectedAccountId}
        editing={editing}
        showMinorUnits={showMinorUnits}
        onSelect={onSelect}
        onAddAccount={onAddAccount ? () => onAddAccount("cash") : undefined}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
        onAdjustBalance={onAdjustBalance}
      />
      <AccountGroup
        title={t("savings")}
        accounts={savingAccounts}
        selectedAccountId={selectedAccountId}
        editing={editing}
        showMinorUnits={showMinorUnits}
        onSelect={onSelect}
        onAddAccount={onAddAccount ? () => onAddAccount("saving") : undefined}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
        onAdjustBalance={onAdjustBalance}
        allocations={allocations}
        onAddGoal={onAddGoal}
        onEditGoal={onEditGoal}
        onDeleteGoal={onDeleteGoal}
      />
      <AccountGroup
        title={t("creditCards")}
        accounts={creditCardAccounts}
        selectedAccountId={selectedAccountId}
        editing={editing}
        showMinorUnits={showMinorUnits}
        onSelect={onSelect}
        onAddAccount={onAddAccount ? () => onAddAccount("credit_card") : undefined}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
        onAdjustBalance={onAdjustBalance}
      />
      <AccountGroup
        title={t("debt")}
        accounts={debtAccounts}
        selectedAccountId={selectedAccountId}
        editing={editing}
        showMinorUnits={showMinorUnits}
        onSelect={onSelect}
        onAddAccount={onAddAccount ? () => onAddAccount("debt") : undefined}
        onEditAccount={onEditAccount}
        onDeleteAccount={onDeleteAccount}
        onAdjustBalance={onAdjustBalance}
      />
    </div>
  );
}
