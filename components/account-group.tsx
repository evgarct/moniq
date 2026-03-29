import { Ellipsis, PencilLine, Plus, Trash2 } from "lucide-react";

import { AccountCard } from "@/components/account-card";
import { EmptyState } from "@/components/empty-state";
import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getAllocationProgress, getFreeMoney, isTargetedAllocation } from "@/features/allocations/lib/allocation-utils";
import { formatMoney } from "@/lib/formatters";
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
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3 pb-2">
        <h3 className="text-[22px] font-heading font-normal text-slate-900">{title}</h3>
        {editing && onAddAccount ? (
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
            aria-label={`Add ${title} wallet`}
            title={`Add ${title} wallet`}
            onClick={onAddAccount}
          >
            <Plus className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      {accounts.length ? (
        <div className="space-y-1.5">
          {accounts.map((account) => (
            <div key={account.id} className="space-y-1">
              <AccountCard
                account={account}
                allocations={allocations}
                selected={account.id === selectedAccountId}
                editing={editing}
                onSelect={() => onSelect(account.id)}
                onEdit={onEditAccount}
                onDelete={onDeleteAccount}
                onAddSubgroup={onAddSubgroup}
              />
              {account.type === "saving" ? (
                <div className="ml-7 space-y-1 border-l border-border/80 pl-4 py-1">
                  <SavingChildRow
                    label="Free"
                    amount={Math.max(0, getFreeMoney(account.balance, allocations, account.id))}
                    currency={account.currency}
                    tooltip="Money still available to withdraw or reassign."
                    detail="Available to withdraw"
                    variant="free"
                  />
                  {allocations
                    .filter((allocation) => allocation.account_id === account.id)
                    .map((allocation) => (
                      <SavingChildRow
                        key={allocation.id}
                        label={allocation.name}
                        amount={allocation.amount}
                        currency={account.currency}
                        targetAmount={allocation.target_amount}
                        progress={getAllocationProgress(allocation)}
                        tooltip={`Savings goal inside ${account.name}`}
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
                                    className="rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                                    aria-label={`More actions for ${allocation.name}`}
                                  />
                                }
                              >
                                <Ellipsis className="h-4 w-4" />
                              </DropdownMenuTrigger>
                              <DropdownMenuContent className="w-40 rounded-xl bg-white p-1.5">
                                {onEditAllocation ? (
                                  <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={() => onEditAllocation(allocation)}>
                                    <PencilLine className="h-4 w-4" />
                                    Edit goal
                                  </DropdownMenuItem>
                                ) : null}
                                {onDeleteAllocation ? (
                                  <DropdownMenuItem
                                    className="rounded-lg px-2 py-2 text-[13px]"
                                    variant="destructive"
                                    onClick={() => onDeleteAllocation(allocation)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete goal
                                  </DropdownMenuItem>
                                ) : null}
                              </DropdownMenuContent>
                            </DropdownMenu>
                          ) : null
                        }
                      />
                    ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <EmptyState title="No accounts yet" description="Add an account to start organizing money and liabilities." />
      )}
    </section>
  );
}

function SavingChildRow({
  label,
  amount,
  currency,
  targetAmount,
  progress,
  tooltip,
  detail,
  variant,
  editing,
  actions,
}: {
  label: string;
  amount: number;
  currency: CurrencyCode;
  targetAmount?: number | null;
  progress?: number | null;
  tooltip: string;
  detail?: string;
  variant?: "free" | "open" | "targeted";
  editing?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className="group relative rounded-2xl px-3 py-3 transition-colors hover:bg-white/65"
      title={tooltip}
    >
      <div className="absolute left-[-16px] top-1/2 h-px w-4 bg-[#e4dbc9] -translate-y-1/2" />
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="pr-2 text-[14px] leading-5 font-medium text-slate-800 break-words">
            {label}
          </p>
          {detail ? (
            <p className="mt-0.5 text-[11px] font-medium tracking-[0.01em] text-slate-500">{detail}</p>
          ) : null}
        </div>

        <div className="flex items-start gap-1 justify-self-end">
          <div className="min-w-[136px] text-right">
            {variant === "targeted" && targetAmount !== null && targetAmount !== undefined ? (
              <div className="space-y-0.5">
                <div className="flex flex-wrap items-center justify-end gap-1 text-[13px] font-semibold">
                  <MoneyAmount
                    amount={amount}
                    currency={currency}
                    display="absolute"
                    className="text-[14px] font-semibold text-slate-900"
                  />
                  <span className="text-slate-400">/</span>
                  <MoneyAmount
                    amount={targetAmount}
                    currency={currency}
                    display="absolute"
                    tone="muted"
                    className="text-[13px] font-medium text-slate-500"
                  />
                </div>
                <p className="text-[11px] font-medium text-slate-400">
                  {Math.round((progress ?? 0) * 100)}% saved
                </p>
              </div>
            ) : (
              <MoneyAmount
                amount={amount}
                currency={currency}
                display="absolute"
                className="text-[14px] font-semibold text-slate-900"
              />
            )}
          </div>
          {editing && actions ? (
            <div className="mt-[-2px] opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
              {actions}
            </div>
          ) : null}
        </div>

        {variant === "targeted" && progress !== null && progress !== undefined ? (
          <div className="col-span-2 pl-px">
            <div className="h-2 w-full overflow-hidden rounded-full bg-[#ece4d6] ring-1 ring-[#e6dccb]/80">
              <div
                className="h-full rounded-full bg-slate-700 transition-[width]"
                style={{ width: `${progress <= 0 ? 0 : Math.max(progress * 100, 6)}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-3 text-[11px] font-medium text-slate-400">
              <span>{formatMoney(amount, currency)}</span>
              <span>{formatMoney(targetAmount ?? 0, currency)}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
