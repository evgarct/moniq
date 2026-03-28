import { SectionCard } from "@/components/section-card";
import { TransactionList } from "@/components/transaction-list";
import type { Transaction } from "@/types/finance";

export function RecentTransactions({ transactions }: { transactions: Transaction[] }) {
  return (
    <SectionCard title="Recent transactions" description="A simple rolling list for quick review.">
      <TransactionList transactions={transactions} emptyMessage="No recent transactions yet." />
    </SectionCard>
  );
}
