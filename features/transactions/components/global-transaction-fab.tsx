"use client";

import { TransactionFab } from "@/features/transactions/components/transaction-fab";
import { useRouter } from "@/i18n/navigation";
import type { Transaction } from "@/types/finance";

export function GlobalTransactionFab() {
  const router = useRouter();

  function openTransactionFlow(kind: Transaction["kind"]) {
    const searchParams = new URLSearchParams({
      new: "1",
      kind,
    });

    router.push(`/transactions?${searchParams.toString()}`);
  }

  return <TransactionFab onSelect={openTransactionFlow} />;
}
