import { Ellipsis, PencilLine, PiggyBank, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccountCard } from "@/components/account-card";
import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getAllocationProgress, isTargetedAllocation } from "@/features/allocations/lib/allocation-utils";
import type { CurrencyCode } from "@/types/currency";
import type { Account, Allocation } from "@/types/finance";

export function AccountGroup({
  title,
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
  title: string;
  accounts: Account[];
  allocations: Allocation[];
  selectedAccountId: string | null;
  editing?: boolean;
  onSelect: (accountId: string) => void;
  onAddAccount?: () => void;
  onEditAccount?: (account: Account) => void;
  onDeleteAccount?: (account: Account) => void;
  onAddSubgroup?: (account: Account) => void;
  onEditAllocation?: (allocation: Allocation) => void;
  onDeleteAllocation?: (allocation: Allocation) => void;
}) {
  const tr = useTranslations();
  const t = useTranslations("accounts");
  return (
    <section className="space-y-3.5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="type-h6">{title}</h3>
        {editing && onAddAccount ? (
          <Tooltip>
            <TooltipTrigger
              render={<Button variant="ghost" size="icon-sm" aria-label={`Add ${title} wallet`} />}
              onClick={onAddAccount}
            >
              <Plus />
            </TooltipTrigger>
            <TooltipContent>{`${t("view.addWallet")} ${title}`}</TooltipContent>
          </Tooltip>
        ) : null}
      </div>

      {accounts.length ? (
        <div className="space-y-3">
          {accounts.map((account) => (
            <div key={account.id} className="space-y-2">
              {account.type === "saving" ? (
                <SavingsAccountBlock
                  account={account}
                  allocations={allocations.filter((allocation) => allocation.account_id === account.id)}
                  selected={account.id === selectedAccountId}
                  editing={editing}
                  onSelect={() => onSelect(account.id)}
                  onEdit={onEditAccount}
                  onDelete={onDeleteAccount}
                  onAddSubgroup={onAddSubgroup}
                  onEditAllocation={onEditAllocation}
                  onDeleteAllocation={onDeleteAllocation}
                />
              ) : (
                <AccountCard
                  account={account}
                  selected={account.id === selectedAccountId}
                  editing={editing}
                  onSelect={() => onSelect(account.id)}
                  onEdit={onEditAccount}
                  onDelete={onDeleteAccount}
                  onAddSubgroup={onAddSubgroup}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="type-body-14 px-4 py-2 text-muted-foreground">
          {tr("common.empty.noAccountsYet")}
        </div>
      )}

      <Separator />
    </section>
  );
}

function SavingsAccountBlock({
  account,
  allocations,
  selected,
  editing,
  onSelect,
  onEdit,
  onDelete,
  onAddSubgroup,
  onEditAllocation,
  onDeleteAllocation,
}: {
  account: Account;
  allocations: Allocation[];
  selected?: boolean;
  editing?: boolean;
  onSelect?: () => void;
  onEdit?: (account: Account) => void;
  onDelete?: (account: Account) => void;
  onAddSubgroup?: (account: Account) => void;
  onEditAllocation?: (allocation: Allocation) => void;
  onDeleteAllocation?: (allocation: Allocation) => void;
}) {
  const tr = useTranslations();
  const t = useTranslations("accounts");
  return (
    <div className="space-y-1">
      <div className="relative rounded-lg">
        <button
          type="button"
          onClick={onSelect}
          className={
            selected
              ? "grid w-full grid-cols-[minmax(0,1fr)_220px] items-center gap-4 rounded-lg border-l-2 border-primary bg-muted/55 px-3 py-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/20"
              : "grid w-full grid-cols-[minmax(0,1fr)_220px] items-center gap-4 rounded-lg px-3 py-3 text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring/20"
          }
        >
          <div className="flex min-w-0 items-center gap-3">
            <PiggyBank className="size-5 shrink-0 text-muted-foreground" strokeWidth={1.9} />
            <span className="type-h6 truncate pr-2">{account.name}</span>
          </div>
            <div className="w-[220px] text-right">
              <MoneyAmount
                amount={account.balance}
                currency={account.currency}
                display="absolute"
                tone="muted"
                className="text-[14px] leading-6 font-normal text-muted-foreground"
              />
            </div>
        </button>
        {editing && (onEdit || onDelete || onAddSubgroup) ? (
          <div className="absolute top-1/2 right-1 -translate-y-1/2">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label={`${tr("common.actions.edit")} ${account.name}`}
                  />
                }
              >
                <Ellipsis className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-40 rounded-xl p-1.5">
                {onAddSubgroup ? (
                  <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={() => onAddSubgroup(account)}>
                    <Plus className="h-4 w-4" />
                    {t("actions.addGoal")}
                  </DropdownMenuItem>
                ) : null}
                {onEdit ? (
                  <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={() => onEdit(account)}>
                    <PencilLine className="h-4 w-4" />
                    {t("actions.editWallet")}
                  </DropdownMenuItem>
                ) : null}
                {onDelete ? (
                  <DropdownMenuItem
                    className="rounded-lg px-2 py-2 text-[13px]"
                    variant="destructive"
                    onClick={() => onDelete(account)}
                  >
                    <Trash2 className="h-4 w-4" />
                    {t("actions.deleteWallet")}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : null}
      </div>

      {allocations.length ? (
        <div className="ml-8 border-l border-border/40 pl-4 py-1">
          <div className="space-y-4">
            {allocations.map((allocation) => (
              <SavingChildRow
                key={allocation.id}
                label={allocation.name}
                amount={allocation.amount}
                currency={account.currency}
                targetAmount={allocation.target_amount}
                progress={getAllocationProgress(allocation)}
                variant={isTargetedAllocation(allocation) ? "targeted" : "open"}
                editing={editing}
                actions={
                  editing && (onEditAllocation || onDeleteAllocation) ? (
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full"
                            aria-label={`${tr("common.actions.edit")} ${allocation.name}`}
                          />
                        }
                      >
                        <Ellipsis className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="w-40 rounded-xl p-1.5">
                        {onEditAllocation ? (
                          <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={() => onEditAllocation(allocation)}>
                            <PencilLine className="h-4 w-4" />
                            {t("actions.editGoal")}
                          </DropdownMenuItem>
                        ) : null}
                        {onDeleteAllocation ? (
                          <DropdownMenuItem
                            className="rounded-lg px-2 py-2 text-[13px]"
                            variant="destructive"
                            onClick={() => onDeleteAllocation(allocation)}
                          >
                            <Trash2 className="h-4 w-4" />
                            {t("actions.deleteGoal")}
                          </DropdownMenuItem>
                        ) : null}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  ) : null
                }
              />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SavingChildRow({
  label,
  amount,
  currency,
  targetAmount,
  progress,
  variant,
  editing,
  actions,
}: {
  label: string;
  amount: number;
  currency: CurrencyCode;
  targetAmount?: number | null;
  progress?: number | null;
  variant?: "free" | "open" | "targeted";
  editing?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div className="group relative space-y-1.5">
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_220px] items-center gap-x-4">
        <div className="min-w-0">
          <p className="type-body-12 truncate pr-2">{label}</p>
        </div>

        <div className="w-[220px] justify-self-end text-right">
          {variant === "targeted" && targetAmount !== null && targetAmount !== undefined ? (
            <div className="inline-flex items-center justify-end gap-1 type-body-12">
              <MoneyAmount
                amount={amount}
                currency={currency}
                display="absolute"
                tone="muted"
                className="type-body-12"
              />
              <span className="text-muted-foreground">/</span>
              <MoneyAmount
                amount={targetAmount}
                currency={currency}
                display="absolute"
                tone="muted"
                className="type-body-12"
              />
            </div>
          ) : (
            <MoneyAmount
              amount={amount}
              currency={currency}
              display="absolute"
              tone="muted"
              className="type-body-12"
            />
          )}
        </div>
      </div>

      {variant === "targeted" && progress !== null && progress !== undefined ? (
        <div className="pr-1">
          <div className="h-1 w-full overflow-hidden rounded-full bg-border/45">
            <div
              className="h-full rounded-full bg-primary transition-[width]"
              style={{ width: `${Math.max(progress * 100, 0)}%` }}
            />
          </div>
        </div>
      ) : null}
      {editing && actions ? <div className="absolute top-0 right-0">{actions}</div> : null}
    </div>
  );
}
