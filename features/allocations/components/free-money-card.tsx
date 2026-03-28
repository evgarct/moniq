import { MoneyAmount } from "@/components/money-amount";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CurrencyCode } from "@/types/currency";

export function FreeMoneyCard({
  amount,
  currency,
}: {
  amount: number;
  currency: CurrencyCode;
}) {
  return (
    <Card className="border border-border shadow-none">
      <CardHeader className="border-b">
        <CardTitle>Free money</CardTitle>
      </CardHeader>
      <CardContent className="pt-4">
        <MoneyAmount
          amount={amount}
          currency={currency}
          tone={amount <= 0 ? "negative" : "positive"}
          className="text-2xl font-semibold"
        />
        <p className="mt-2 text-sm text-muted-foreground">
          Unallocated savings available for new goals.
        </p>
      </CardContent>
    </Card>
  );
}
