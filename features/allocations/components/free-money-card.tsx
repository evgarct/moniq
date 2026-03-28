import { MoneyAmount } from "@/components/money-amount";

export function FreeMoneyCard({
  amount,
  currency,
}: {
  amount: number;
  currency: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-white/18 py-2.5">
      <div>
        <p className="text-[10px] uppercase tracking-[0.14em] text-slate-300/80">Free money</p>
        <p className="mt-0.5 text-[12px] text-slate-300/85">Unallocated savings available for new goals.</p>
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
