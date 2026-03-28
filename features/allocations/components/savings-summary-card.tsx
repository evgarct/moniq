import { MoneyAmount } from "@/components/money-amount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurrencyCode } from "@/types/currency";

export function SavingsSummaryCard({
  balance,
  allocated,
  freeMoney,
  currency,
}: {
  balance: number;
  allocated: number;
  freeMoney: number;
  currency: CurrencyCode;
}) {
  return (
    <Card className="border border-border shadow-none">
      <CardHeader className="border-b">
        <CardTitle>Savings summary</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 sm:grid-cols-3">
        <SummaryMetric label="Account balance" amount={balance} currency={currency} display="absolute" />
        <SummaryMetric label="Allocated total" amount={allocated} currency={currency} display="absolute" />
        <SummaryMetric
          label="Free money"
          amount={freeMoney}
          currency={currency}
          tone={freeMoney <= 0 ? "negative" : "positive"}
          display="signed"
        />
      </CardContent>
    </Card>
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
  currency: CurrencyCode;
  tone?: "default" | "positive" | "negative";
  display?: "absolute" | "signed";
}) {
  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <MoneyAmount amount={amount} currency={currency} tone={tone} display={display} className="text-lg font-semibold" />
    </div>
  );
}
