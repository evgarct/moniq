import { useState } from "react";
import { Check, PencilLine, Plus, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { AccountAmount } from "@/components/account-amount";
import { AccountCard } from "@/components/account-card";
import { ProgressTrack } from "@/components/progress-track";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getAllocationProgress, isTargetedAllocation } from "@/features/allocations/lib/allocation-utils";
import { formatMoneyNumber, getCurrencySymbol } from "@/lib/formatters";
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
  showMinorUnits = true,
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
  showMinorUnits?: boolean;
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
            <div key={account.id} className="flex flex-col gap-0.5">
              {account.type === "saving" ? (
                <SavingsAccountBlock
                  account={account}
                  allocations={allocations.filter((allocation) => allocation.account_id === account.id)}
                  selected={account.id === selectedAccountId}
                  selectedAllocationId={selectedAllocationId}
                  showMinorUnits={showMinorUnits}
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
                  showMinorUnits={showMinorUnits}
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
        <div className="px-1.5 py-1 text-[13px] leading-5 text-muted-foreground sm:type-body-14 sm:px-2.5">
          {tr("common.empty.noAccountsYet")}
        </div>
      )}

    </section>
  );
}

function SavingsAccountBlock({
  account,
  allocations,
  selected,
  selectedAllocationId,
  showMinorUnits,
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
  showMinorUnits: boolean;
  onSelect?: () => void;
  onSelectAllocation?: (allocation: Allocation) => void;
  onEdit?: (account: Account) => void;
  onDelete?: (account: Account) => void;
  onAddSubgroup?: (account: Account) => void;
  onEditAllocation?: (allocation: Allocation) => void;
  onDeleteAllocation?: (allocation: Allocation) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:gap-1">
      <AccountCard
        account={account}
        selected={selected}
        showMinorUnits={showMinorUnits}
        onSelect={onSelect}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddSubgroup={onAddSubgroup}
      />

      {allocations.length ? (
        <div className="flex flex-col gap-1 py-0.5 sm:gap-1.5 sm:py-1">
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
              showMinorUnits={showMinorUnits}
              onSelect={onSelectAllocation ? () => onSelectAllocation(allocation) : undefined}
              onEdit={onEditAllocation ? () => onEditAllocation(allocation) : undefined}
              onDelete={onDeleteAllocation ? () => onDeleteAllocation(allocation) : undefined}
            />
          ))}
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
  showMinorUnits,
  onSelect,
  onEdit,
  onDelete,
}: {
  label: string;
  amount: number;
  currency: CurrencyCode;
  targetAmount?: number | null;
  progress?: number | null;
  variant?: "free" | "open" | "targeted";
  selected?: boolean;
  showMinorUnits: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations("accounts");
  const currentAmountLabel = formatMoneyNumber(Math.abs(amount), currency, { showMinorUnits });
  const currencySymbol = getCurrencySymbol(currency);
  const [contextAnchor, setContextAnchor] = useState<{ x: number; y: number } | null>(null);
  const hasActions = Boolean(onEdit || onDelete);
  const targetAmountLabel =
    variant === "targeted" && targetAmount !== null && targetAmount !== undefined
      ? formatMoneyNumber(Math.abs(targetAmount), currency, { showMinorUnits })
      : null;

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    if (!hasActions) {
      return;
    }

    event.preventDefault();
    setContextAnchor({ x: event.clientX, y: Math.max(event.clientY - 6, 0) });
  }

  return (
    <div className="group/goal relative flex flex-col gap-0" onContextMenu={handleContextMenu}>
      <div className="relative">
        <button
          type="button"
          onClick={onSelect}
          className={cn(
            "grid min-w-0 w-full grid-cols-[16px_minmax(0,1fr)_minmax(96px,auto)] items-center gap-x-2.5 rounded-sm px-1.5 py-1 text-left outline-none transition-[background-color,color] sm:gap-x-3 sm:px-2.5 sm:py-1.5",
            selected ? "bg-transparent text-foreground" : "bg-transparent hover:text-foreground active:text-foreground",
            onSelect ? "focus-visible:border-ring/45 focus-visible:ring-2 focus-visible:ring-ring/20" : "",
          )}
        >
          <span className="flex size-4 shrink-0 items-center justify-center">
            {selected ? <Check className="size-3.5 text-foreground" strokeWidth={2.25} /> : null}
          </span>

          <div className="min-w-0 overflow-hidden">
            <p className={cn("truncate text-[12px] leading-[18px] font-medium sm:text-[13px] sm:leading-5", selected ? "text-foreground" : "text-foreground/92")}>
              {label}
            </p>
          </div>

          <div className="w-full justify-self-end">
            {targetAmountLabel ? (
              <span className="inline-grid w-full grid-cols-[minmax(0,1fr)_2.25ch] items-baseline justify-end gap-1">
                <span className="min-w-0 justify-self-end overflow-hidden text-ellipsis whitespace-nowrap text-[12px] leading-5">
                  <span className={cn("tabular-nums", selected ? "text-foreground/90" : "text-muted-foreground")}>
                    {currentAmountLabel}
                  </span>
                  <span className="px-1 text-muted-foreground">/</span>
                  <span className="tabular-nums text-muted-foreground">
                    {targetAmountLabel}
                  </span>
                </span>
                <span className="justify-self-center text-[12px] leading-4 font-medium text-muted-foreground">
                  {currencySymbol}
                </span>
              </span>
            ) : (
              <AccountAmount
                amount={amount}
                currency={currency}
                display="absolute"
                tone={selected ? "default" : "muted"}
                showMinorUnits={showMinorUnits}
                className="w-full"
                numberClassName="text-[12px] leading-5"
              />
            )}
          </div>
        </button>
      </div>
      {hasActions && contextAnchor ? (
        <DropdownMenu open onOpenChange={(open) => (!open ? setContextAnchor(null) : null)}>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="pointer-events-none fixed h-px w-px min-h-0 min-w-0 p-0 opacity-0"
                style={{ left: contextAnchor.x, top: contextAnchor.y }}
                aria-label={label}
              />
            }
          />
          <DropdownMenuContent className="w-40 rounded-xl p-1.5" side="right" align="start" sideOffset={6} alignOffset={-6}>
            {onEdit ? (
              <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={onEdit}>
                <PencilLine className="h-4 w-4" />
                {t("actions.editGoal")}
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
              <DropdownMenuItem
                className="rounded-lg px-2 py-2 text-[13px]"
                variant="destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-4 w-4" />
                {t("actions.deleteGoal")}
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {variant === "targeted" && progress !== null && progress !== undefined ? (
        <div className="-mt-0.5 pb-0.5 pl-8 pr-1.5 sm:pl-[38px] sm:pr-2.5">
          <ProgressTrack
            value={progress}
            className="h-0.5"
            trackClassName={selected ? "bg-foreground/15" : "bg-border/30"}
            fillClassName={selected ? "bg-foreground/85" : "bg-foreground/60"}
          />
        </div>
      ) : null}
    </div>
  );
}
