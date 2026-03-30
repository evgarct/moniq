import { Check, Ellipsis, PencilLine, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccountAmount } from "@/components/account-amount";
import { AccountCard } from "@/components/account-card";
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
import { formatMoneyNumber } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";
import type { Account, Allocation } from "@/types/finance";

export function AccountGroup({
  title,
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
  title: string;
  accounts: Account[];
  allocations: Allocation[];
  selectedAccountId: string | null;
  selectedAllocationId?: string | null;
  editing?: boolean;
  onSelect: (accountId: string) => void;
  onSelectAllocation?: (allocation: Allocation) => void;
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
    <section className="flex flex-col gap-2.5">
      <div className="flex items-center justify-between gap-3 px-2.5">
        <h3 className="text-[11px] leading-4 font-medium tracking-[0.14em] text-muted-foreground uppercase">
          {title}
        </h3>
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
        <div className="flex flex-col gap-1.5">
          {accounts.map((account) => (
            <div key={account.id} className="flex flex-col gap-1">
              {account.type === "saving" ? (
                <SavingsAccountBlock
                  account={account}
                  allocations={allocations.filter((allocation) => allocation.account_id === account.id)}
                  selected={account.id === selectedAccountId}
                  selectedAllocationId={selectedAllocationId}
                  editing={editing}
                  onSelect={() => onSelect(account.id)}
                  onSelectAllocation={onSelectAllocation}
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
        <div className="type-body-14 px-2.5 py-1 text-muted-foreground">
          {tr("common.empty.noAccountsYet")}
        </div>
      )}

      <Separator className="mt-0.5" />
    </section>
  );
}

function SavingsAccountBlock({
  account,
  allocations,
  selected,
  selectedAllocationId,
  editing,
  onSelect,
  onSelectAllocation,
  onEdit,
  onDelete,
  onAddSubgroup,
  onEditAllocation,
  onDeleteAllocation,
}: {
  account: Account;
  allocations: Allocation[];
  selected?: boolean;
  selectedAllocationId?: string | null;
  editing?: boolean;
  onSelect?: () => void;
  onSelectAllocation?: (allocation: Allocation) => void;
  onEdit?: (account: Account) => void;
  onDelete?: (account: Account) => void;
  onAddSubgroup?: (account: Account) => void;
  onEditAllocation?: (allocation: Allocation) => void;
  onDeleteAllocation?: (allocation: Allocation) => void;
}) {
  const tr = useTranslations();
  const t = useTranslations("accounts");

  return (
    <div className="flex flex-col gap-1">
      <AccountCard
        account={account}
        selected={selected}
        editing={editing}
        onSelect={onSelect}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddSubgroup={onAddSubgroup}
      />

      {allocations.length ? (
        <div className="ml-[6px] border-l border-border/35 pl-4">
          <div className="flex flex-col gap-1.5 py-1">
            {allocations.map((allocation) => (
              <SavingChildRow
                key={allocation.id}
                label={allocation.name}
                amount={allocation.amount}
                currency={account.currency}
                targetAmount={allocation.target_amount}
                progress={getAllocationProgress(allocation)}
                variant={isTargetedAllocation(allocation) ? "targeted" : "open"}
                selected={allocation.id === selectedAllocationId}
                editing={editing}
                onSelect={onSelectAllocation ? () => onSelectAllocation(allocation) : undefined}
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
  selected,
  editing,
  onSelect,
  actions,
}: {
  label: string;
  amount: number;
  currency: CurrencyCode;
  targetAmount?: number | null;
  progress?: number | null;
  variant?: "free" | "open" | "targeted";
  selected?: boolean;
  editing?: boolean;
  onSelect?: () => void;
  actions?: React.ReactNode;
}) {
  const currentAmountLabel = formatMoneyNumber(Math.abs(amount), currency);
  const targetAmountLabel =
    variant === "targeted" && targetAmount !== null && targetAmount !== undefined
      ? formatMoneyNumber(Math.abs(targetAmount), currency)
      : null;

  return (
    <div className="group/goal relative flex flex-col gap-0.5">
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "grid min-w-0 w-full grid-cols-[16px_minmax(0,1fr)_168px] items-center gap-x-3 rounded-md px-2.5 py-1 text-left outline-none transition-[color]",
          selected ? "text-foreground" : "hover:text-foreground active:text-foreground",
          onSelect ? "focus-visible:border-ring/45 focus-visible:ring-2 focus-visible:ring-ring/20" : "",
          editing && actions ? "pr-10" : "",
        )}
      >
        <span className="flex size-4 shrink-0 items-center justify-center">
          {selected ? <Check className="size-3.5 text-foreground" strokeWidth={2.25} /> : null}
        </span>

        <div className="min-w-0 overflow-hidden">
          <p className={cn("truncate text-[13px] leading-5 font-medium", selected ? "text-foreground" : "text-foreground/92")}>
            {label}
          </p>
        </div>

        <div className="w-[168px] justify-self-end">
          {targetAmountLabel ? (
            <span className="inline-grid w-full grid-cols-[minmax(0,1fr)_3.5ch] items-baseline justify-end gap-2">
              <span className="min-w-0 justify-self-end overflow-hidden text-ellipsis whitespace-nowrap text-[12px] leading-5">
                <span className={cn("tabular-nums", selected ? "text-foreground/90" : "text-muted-foreground")}>
                  {currentAmountLabel}
                </span>
                <span className="px-1 text-muted-foreground">/</span>
                <span className="tabular-nums text-muted-foreground">
                  {targetAmountLabel}
                </span>
              </span>
              <span className="justify-self-end text-[11px] leading-4 font-medium tracking-[0.08em] text-muted-foreground uppercase">
                {currency}
              </span>
            </span>
          ) : (
            <AccountAmount
              amount={amount}
              currency={currency}
              display="absolute"
              tone={selected ? "default" : "muted"}
              className="w-full"
              numberClassName="text-[12px] leading-5"
            />
          )}
        </div>
      </button>

      {variant === "targeted" && progress !== null && progress !== undefined ? (
        <div className="pl-[38px] pr-2.5 pb-0.5">
          <div className={cn("h-0.5 w-full overflow-hidden rounded-full", selected ? "bg-border/55" : "bg-border/40")}>
            <div
              className={cn("h-full rounded-full transition-[width,background-color]", selected ? "bg-foreground/85" : "bg-foreground/60")}
              style={{ width: `${Math.max(progress * 100, 0)}%` }}
            />
          </div>
        </div>
      ) : null}
      {editing && actions ? <div className="absolute top-0 right-0">{actions}</div> : null}
    </div>
  );
}
