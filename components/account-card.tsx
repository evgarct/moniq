import { BanknoteArrowDown, CreditCard, Landmark, PiggyBank } from "lucide-react";

import { MoneyAmount } from "@/components/money-amount";
import { getFreeMoney } from "@/features/allocations/lib/allocation-utils";
import { isDebtAccount } from "@/features/accounts/lib/account-utils";
import { cn } from "@/lib/utils";
import type { Account, Allocation } from "@/types/finance";

export function AccountCard({
  account,
  allocations,
  selected = false,
  onSelect,
}: {
  account: Account;
  allocations: Allocation[];
  selected?: boolean;
  onSelect?: () => void;
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
    <button
      type="button"
      onClick={onSelect}
      title={tooltip}
      className={cn(
        "relative w-full rounded-2xl px-3 py-3 text-left transition-colors",
        selected ? "bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]" : "hover:bg-white/70",
      )}
    >
      <span
        className={cn(
          "absolute inset-y-2 left-0 w-1 rounded-full transition-colors",
          selected ? "bg-slate-700/70" : "bg-transparent",
        )}
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white/80 text-slate-500">
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
      </div>
    </button>
  );
}
