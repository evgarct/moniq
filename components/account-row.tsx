import { AccountTypeBadge } from "@/components/account-type-badge";
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

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-border/70 border-l-2 border-l-transparent px-3 py-3 text-left transition-colors",
        selected && "border-l-primary bg-muted/55",
        !selected && "hover:bg-muted/35",
      )}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <p className="truncate text-[15px] font-medium text-foreground">{account.name}</p>
          <AccountTypeBadge type={account.type} />
        </div>
        <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
          <span>{account.currency}</span>
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

      <MoneyAmount
        amount={account.balance}
        currency={account.currency}
        display={debt ? "signed" : "absolute"}
        tone={debt ? "negative" : "default"}
        className="text-[20px] font-semibold"
      />
    </button>
  );
}
