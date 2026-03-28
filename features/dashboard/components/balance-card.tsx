import { MoneyAmount } from "@/components/money-amount";
import { SectionCard } from "@/components/section-card";

export function BalanceCard({ totalBalance }: { totalBalance: number }) {
  return (
    <SectionCard title="Total balance" description="Across all connected accounts.">
      <MoneyAmount amount={totalBalance} className="text-[28px] font-semibold text-foreground" />
    </SectionCard>
  );
}
