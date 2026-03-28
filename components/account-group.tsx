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
import { getFreeMoney } from "@/features/allocations/lib/allocation-utils";
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
      <div className="flex items-center justify-between gap-3 border-b border-black/5 pb-1.5">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{title}</h3>
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
                <div className="ml-11 space-y-1 border-l border-black/5 pl-3">
                  <SavingChildRow
                    label="Uncategorized"
                    amount={Math.max(0, getFreeMoney(account.balance, allocations, account.id))}
                    currency={account.currency}
                    tooltip="System remainder for savings without a subgroup."
                    editing={false}
                  />
                  {allocations
                    .filter((allocation) => allocation.account_id === account.id)
                    .map((allocation) => (
                      <SavingChildRow
                        key={allocation.id}
                        label={allocation.name}
                        amount={allocation.amount}
                        currency={account.currency}
                        tooltip={`Saving subgroup inside ${account.name}`}
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
                                    Edit subgroup
                                  </DropdownMenuItem>
                                ) : null}
                                {onDeleteAllocation ? (
                                  <DropdownMenuItem
                                    className="rounded-lg px-2 py-2 text-[13px]"
                                    variant="destructive"
                                    onClick={() => onDeleteAllocation(allocation)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete subgroup
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
  tooltip,
  editing,
  actions,
}: {
  label: string;
  amount: number;
  currency: CurrencyCode;
  tooltip: string;
  editing?: boolean;
  actions?: React.ReactNode;
}) {
  return (
    <div
      className="group flex items-center justify-between gap-3 rounded-xl px-2 py-2 hover:bg-white/60"
      title={tooltip}
    >
      <p className="truncate text-[13px] text-slate-600">{label}</p>
      <div className="flex items-center gap-1">
        <MoneyAmount amount={amount} currency={currency} display="absolute" className="text-[12px] font-medium text-slate-700" />
        {editing && actions ? <div className="opacity-0 transition-opacity group-hover:opacity-100">{actions}</div> : null}
      </div>
    </div>
  );
}
