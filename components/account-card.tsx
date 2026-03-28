import { MoneyAmount } from "@/components/money-amount";
import { AccountTypeBadge } from "@/components/account-type-badge";
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
  const allocatedTotal = account.type === "savings" ? account.balance - getFreeMoney(account.balance, allocations, account.id) : 0;
  const freeMoney = account.type === "savings" ? getFreeMoney(account.balance, allocations, account.id) : null;
  const debt = isDebtAccount(account);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-xl border px-4 py-4 text-left transition-colors",
        selected ? "border-primary bg-accent/70" : "border-border bg-card hover:bg-muted/60",
        debt && "border-destructive/20 bg-destructive/5 hover:bg-destructive/8",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div>
            <p className="font-medium">{account.name}</p>
            <p className="mt-1 text-sm text-muted-foreground">{account.currency}</p>
          </div>
          <AccountTypeBadge type={account.type} />
        </div>

        <MoneyAmount
          amount={account.balance}
          currency={account.currency}
          display={debt ? "signed" : "absolute"}
          tone={debt ? "negative" : "default"}
          className="text-base"
        />
      </div>

      {account.type === "savings" ? (
        <div className="mt-4 grid gap-3 rounded-lg border border-border/70 bg-background/80 p-3 sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Allocated</p>
            <MoneyAmount amount={allocatedTotal} currency={account.currency} display="absolute" className="mt-1 text-sm" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">Free money</p>
            <MoneyAmount
              amount={freeMoney ?? 0}
              currency={account.currency}
              tone={freeMoney !== null && freeMoney <= 0 ? "negative" : "positive"}
              className="mt-1 text-sm"
            />
          </div>
        </div>
      ) : null}
    </button>
  );
}
