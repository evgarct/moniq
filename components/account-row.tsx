import { Building2, CreditCard, HandCoins, Landmark, PiggyBank } from "lucide-react";

import { MoneyAmount } from "@/components/money-amount";
import { isDebtAccount } from "@/features/accounts/lib/account-utils";
import { getFreeMoney } from "@/features/allocations/lib/allocation-utils";
import { cn } from "@/lib/utils";
import type { Account, Allocation } from "@/types/finance";

export function AccountRow({
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
  const debt = isDebtAccount(account);
  const freeMoney = account.type === "savings" ? getFreeMoney(account.balance, allocations, account.id) : null;
  const Icon =
    account.type === "checking"
      ? Landmark
      : account.type === "savings"
        ? PiggyBank
        : account.type === "credit_card"
          ? CreditCard
          : account.type === "loan"
            ? HandCoins
            : Building2;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-white/18 border-l-2 border-l-transparent px-3 py-3.5 text-left transition-colors",
        selected && "border-l-cyan-400 bg-white/6",
        !selected && "hover:bg-white/4",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 text-slate-100/90">
          <Icon className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold text-white">{account.name}</p>
          <MoneyAmount
            amount={account.balance}
            currency={account.currency}
            display={debt ? "signed" : "absolute"}
            tone={debt ? "negative" : "positive"}
            className="mt-0.5 text-[16px] font-semibold"
          />
          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-slate-300/80">
            <span>{account.type.replace("_", " ")}</span>
            {account.type === "savings" && freeMoney !== null ? (
              <>
                <span>•</span>
                <span>Free</span>
                <MoneyAmount
                  amount={freeMoney}
                  currency={account.currency}
                  tone={freeMoney <= 0 ? "negative" : "positive"}
                  className="text-[11px]"
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </button>
  );
}
