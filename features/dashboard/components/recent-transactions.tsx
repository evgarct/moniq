import { useTranslations } from "next-intl";

import { SectionCard } from "@/components/section-card";
import { TransactionList } from "@/components/transaction-list";
import type { Transaction } from "@/types/finance";

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  const t = useTranslations("dashboard.recent");

  return (
    <SectionCard title={t("title")} description={t("description")}>
      <TransactionList transactions={transactions} emptyMessage={t("empty")} />
    </SectionCard>
  );
}
