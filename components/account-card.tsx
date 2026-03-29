import { BanknoteArrowDown, CreditCard, Ellipsis, Landmark, PencilLine, PiggyBank, Plus, Trash2 } from "lucide-react";

import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getFreeMoney } from "@/features/allocations/lib/allocation-utils";
import { isDebtAccount } from "@/features/accounts/lib/account-utils";
import { cn } from "@/lib/utils";
import type { Account, Allocation } from "@/types/finance";

export function AccountCard({
  account,
  allocations,
  selected = false,
  onSelect,
  editing = false,
  onEdit,
  onDelete,
  onAddSubgroup,
}: {
  account: Account;
  allocations: Allocation[];
  selected?: boolean;
  onSelect?: () => void;
  editing?: boolean;
  onEdit?: (account: Account) => void;
  onDelete?: (account: Account) => void;
  onAddSubgroup?: (account: Account) => void;
}) {
  const freeMoney = account.type === "saving" ? getFreeMoney(account.balance, allocations, account.id) : null;
  const debt = isDebtAccount(account);
  const detailLabel =
    account.type === "debt"
      ? account.debt_kind?.replace("_", " ") ?? "debt"
      : account.type === "cash"
        ? account.cash_kind === "cash_wallet"
          ? "cash wallet"
          : "debit card"
        : account.type.replace("_", " ");
  const AccountIcon =
    account.type === "saving"
      ? PiggyBank
      : account.type === "credit_card"
        ? CreditCard
        : account.type === "debt"
          ? Landmark
          : BanknoteArrowDown;
  const freeMoneyLabel =
    account.type === "saving" && freeMoney !== null ? `Free ${Math.round(freeMoney)} ${account.currency}` : null;
  const tooltip = freeMoneyLabel ? `${detailLabel} - ${freeMoneyLabel}` : detailLabel;

  return (
    <div
      title={tooltip}
      className={cn(
        "relative flex items-center gap-2 rounded-2xl px-3 py-3 transition-colors",
        selected ? "bg-surface shadow-[0_2px_8px_rgba(0,0,0,0.04)]" : "hover:bg-surface/60",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-2 left-0 w-1 rounded-full transition-colors",
          selected ? "bg-slate-800" : "bg-transparent",
        )}
      />
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
      >
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm border border-black/5">
            <AccountIcon className="h-4 w-4" />
          </div>
          <p className="truncate pr-2 text-[14px] font-medium text-slate-900">{account.name}</p>
        </div>

        <MoneyAmount
          amount={account.balance}
          currency={account.currency}
          display={debt ? "signed" : "absolute"}
          tone={debt ? "negative" : "default"}
          className="shrink-0 text-[14px] font-semibold tabular-nums text-slate-900"
        />
      </button>
      {editing && (onEdit || onDelete || (account.type === "saving" && onAddSubgroup)) ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="shrink-0 rounded-lg text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label={`More actions for ${account.name}`}
              />
            }
          >
            <Ellipsis className="h-4 w-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-40 rounded-xl bg-white p-1.5">
            {account.type === "saving" && onAddSubgroup ? (
              <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={() => onAddSubgroup(account)}>
                <Plus className="h-4 w-4" />
                Add goal
              </DropdownMenuItem>
            ) : null}
            {onEdit ? (
              <DropdownMenuItem className="rounded-lg px-2 py-2 text-[13px]" onClick={() => onEdit(account)}>
                <PencilLine className="h-4 w-4" />
                Edit wallet
              </DropdownMenuItem>
            ) : null}
            {onDelete ? (
              <DropdownMenuItem
                className="rounded-lg px-2 py-2 text-[13px]"
                variant="destructive"
                onClick={() => onDelete(account)}
              >
                <Trash2 className="h-4 w-4" />
                Delete wallet
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
