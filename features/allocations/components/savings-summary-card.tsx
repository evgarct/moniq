import { MoneyAmount } from "@/components/money-amount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    <Card className="border border-border shadow-none">
      <CardHeader className="border-b">
        <CardTitle>Savings summary</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 pt-4 sm:grid-cols-3">
        <SummaryMetric label="Account balance" amount={balance} currency={currency} />
        <SummaryMetric label="Allocated total" amount={allocated} currency={currency} />
        <SummaryMetric
          label="Free money"
          amount={freeMoney}
          currency={currency}
          tone={freeMoney <= 0 ? "negative" : "positive"}
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
}: {
  label: string;
  amount: number;
  currency: string;
  tone?: "default" | "positive" | "negative";
}) {
  return (
    <div className="space-y-2 rounded-lg bg-muted/40 p-3">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <MoneyAmount amount={amount} currency={currency} tone={tone} className="text-lg font-semibold" />
    </div>
  );
}
