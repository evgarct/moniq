import { useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { SectionCard } from "@/components/section-card";
import type { CurrencyTotal } from "@/lib/finance-selectors";

export function BalanceCard({ totals }: { totals: CurrencyTotal[] }) {
  const t = useTranslations("dashboard.balanceCard");

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <div className="space-y-3">
        {totals.map((total) => (
          <div key={total.currency} className="flex items-end justify-between gap-4 border-b border-border/70 pb-3 last:border-b-0 last:pb-0">
            <p className="text-sm text-muted-foreground">{total.currency}</p>
            <MoneyAmount amount={total.amount} currency={total.currency} className="text-2xl font-semibold text-foreground" />
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
