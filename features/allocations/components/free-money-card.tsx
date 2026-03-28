import { MoneyAmount } from "@/components/money-amount";

export function FreeMoneyCard({
  amount,
  currency,
}: {
  amount: number;
  currency: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/70 py-2">
      <div>
        <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Free money</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">Unallocated savings available for new goals.</p>
      </div>
      <MoneyAmount
        amount={amount}
        currency={currency}
        tone={amount <= 0 ? "negative" : "positive"}
        className="text-[18px] font-semibold"
      />
    </div>
  );
}
