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

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-2xl px-3 py-3 text-left transition-colors",
        selected ? "bg-white shadow-[0_1px_2px_rgba(15,23,42,0.05)]" : "hover:bg-white/70",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-medium text-slate-900">{account.name}</p>
          <p className="mt-1 text-[11px] text-slate-500">
            {detailLabel}
            {account.type === "saving" && freeMoney !== null ? ` · Free ${Math.round(freeMoney)} ${account.currency}` : ""}
          </p>
        </div>

        <MoneyAmount
          amount={account.balance}
          currency={account.currency}
          display={debt ? "signed" : "absolute"}
          tone={debt ? "negative" : "default"}
          className="text-[14px] font-semibold text-slate-900"
        />
      </div>
    </button>
  );
}
