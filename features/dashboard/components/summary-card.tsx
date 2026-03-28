import { MoneyAmount } from "@/components/money-amount";
import { SectionCard } from "@/components/section-card";

export function SummaryCard({
  income,
  expenses,
}: {
  income: number;
  expenses: number;
}) {
  return (
    <SectionCard title="Quick summary" description="Income and expenses in the current mock timeline.">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-background px-4 py-3">
          <p className="text-sm text-muted-foreground">Income</p>
          <MoneyAmount amount={-income} className="mt-2 text-xl font-semibold" />
        </div>
        <div className="rounded-lg border border-border bg-background px-4 py-3">
          <p className="text-sm text-muted-foreground">Expenses</p>
          <MoneyAmount amount={expenses} className="mt-2 text-xl font-semibold text-foreground" />
        </div>
      </div>
    </SectionCard>
  );
}
