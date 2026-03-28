import { MoneyAmount } from "@/components/money-amount";

export function SavingsSummaryCard({
  balance,
  allocated,
  freeMoney,
  currency,
}: {
  balance: number;
  allocated: number;
  freeMoney: number;
  currency: string;
}) {
  return (
    <div className="grid gap-3 border-b border-border/70 py-2.5 sm:grid-cols-3">
      <SummaryMetric label="Account balance" amount={balance} currency={currency} display="absolute" />
      <SummaryMetric label="Allocated total" amount={allocated} currency={currency} display="absolute" />
      <SummaryMetric
        label="Free money"
        amount={freeMoney}
        currency={currency}
        tone={freeMoney <= 0 ? "negative" : "positive"}
        display="signed"
      />
    </div>
  );
}

function SummaryMetric({
  label,
  amount,
  currency,
  tone = "default",
  display = "signed",
}: {
  label: string;
  amount: number;
  currency: string;
  tone?: "default" | "positive" | "negative";
  display?: "absolute" | "signed";
}) {
  return (
    <div className="space-y-1">
      <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <MoneyAmount amount={amount} currency={currency} tone={tone} display={display} className="text-[18px] font-semibold" />
    </div>
  );
}
