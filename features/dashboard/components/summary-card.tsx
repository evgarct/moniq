import { MoneyAmount } from "@/components/money-amount";
import { SectionCard } from "@/components/section-card";
import type { CurrencyCashflowSummary } from "@/lib/finance-selectors";

export function SummaryCard({
  summary,
}: {
  summary: CurrencyCashflowSummary[];
}) {
  return (
    <SectionCard title="Cashflow by currency" description="Income and expenses stay separated until FX support is added.">
      <div className="space-y-4">
        {summary.map((currencySummary) => (
          <div key={currencySummary.currency} className="space-y-3 border-b border-border/70 pb-4 last:border-b-0 last:pb-0">
            <p className="text-sm text-muted-foreground">{currencySummary.currency}</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">Income</p>
                <MoneyAmount
                  amount={currencySummary.income}
                  currency={currencySummary.currency}
                  display="absolute"
                  tone="positive"
                  className="mt-2 text-xl font-semibold"
                />
              </div>
              <div className="rounded-lg border border-border bg-background px-4 py-3">
                <p className="text-sm text-muted-foreground">Expenses</p>
                <MoneyAmount
                  amount={currencySummary.expenses}
                  currency={currencySummary.currency}
                  display="absolute"
                  className="mt-2 text-xl font-semibold text-foreground"
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
