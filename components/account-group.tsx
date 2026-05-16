import { Plus } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccountCard } from "@/components/account-card";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { Account, WalletAllocation } from "@/types/finance";

export function AccountGroup({
  title,
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
  title: string;
  accounts: Account[];
  selectedAccountId: string | null;
  editing?: boolean;
  showMinorUnits?: boolean;
  onSelect: (accountId: string) => void;
  onAddAccount?: () => void;
  onEditAccount?: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void;
  onAdjustBalance?: (account: Account, newBalance: number) => void;
  allocations?: WalletAllocation[];
  onAddGoal?: (walletId: string) => void;
  onEditGoal?: (allocation: WalletAllocation) => void;
  onDeleteGoal?: (allocation: WalletAllocation) => void;
}) {
  const tr = useTranslations();
  const t = useTranslations("accounts");

  return (
    <section className="flex flex-col gap-2 sm:gap-2.5">
      <div className="flex items-center justify-between gap-3 px-1.5 sm:px-2.5">
        <h3 className="font-heading text-[20px] leading-[1.12] tracking-[-0.028em] text-foreground sm:type-h3">
          {title}
        </h3>
        <div className="flex h-8 w-8 items-center justify-center">
          {editing && onAddAccount ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-md bg-transparent text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground active:bg-[#e6e1d9]"
                    aria-label={`Add ${title} wallet`}
                  />
                }
                onClick={onAddAccount}
              >
                <Plus />
              </TooltipTrigger>
              <TooltipContent>{`${t("view.addWallet")} ${title}`}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      {accounts.length ? (
        <div className="flex flex-col gap-0.5 sm:gap-1">
          {accounts.map((account) => (
            <AccountCard
              key={account.id}
              account={account}
              selected={account.id === selectedAccountId}
              showMinorUnits={showMinorUnits}
              onSelect={() => onSelect(account.id)}
              onEdit={onEditAccount}
              onDelete={onDeleteAccount}
              onAdjustBalance={onAdjustBalance}
              allocations={allocations?.filter((a) => a.wallet_id === account.id)}
              onAddGoal={onAddGoal ? () => onAddGoal(account.id) : undefined}
              onEditGoal={onEditGoal}
              onDeleteGoal={onDeleteGoal}
            />
          ))}
        </div>
      ) : (
        <div className="px-1.5 py-1 text-[13px] leading-5 text-muted-foreground sm:type-body-14 sm:px-2.5">
          {tr("common.empty.noAccountsYet")}
        </div>
      )}
    </section>
  );
}
