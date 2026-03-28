import { MoneyAmount } from "@/components/money-amount";
import { cn } from "@/lib/utils";
import type { Account } from "@/types/finance";

export function AccountCard({
  account,
  selected = false,
  onSelect,
}: {
  account: Account;
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full rounded-lg border px-4 py-4 text-left transition-colors",
        selected ? "border-primary bg-accent" : "border-border bg-card hover:bg-muted/60",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium">{account.name}</p>
          <p className="mt-1 text-sm capitalize text-muted-foreground">{account.type}</p>
        </div>
        <MoneyAmount amount={account.balance} currency={account.currency} className="text-base" />
      </div>
    </button>
  );
}
