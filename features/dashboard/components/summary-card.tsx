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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="border-b border-border/70 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Income</p>
          <MoneyAmount amount={income} display="absolute" tone="positive" className="mt-1 text-[19px] font-semibold" />
        </div>
        <div className="border-b border-border/70 py-2">
          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground">Expenses</p>
          <MoneyAmount amount={expenses} display="absolute" className="mt-1 text-[19px] font-semibold text-foreground" />
        </div>
      </div>
    </SectionCard>
  );
}
