"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Input } from "@/components/ui/input";

type BankTransaction = {
  id: string;
  amount: number;
  currency: string;
  date: string;
  merchant_clean: string;
  category: string | null;
};

export function AllTransactionsClient({ initialRows }: { initialRows: BankTransaction[] }) {
  const t = useTranslations("banking");
  const [category, setCategory] = useState("");
  const [date, setDate] = useState("");

  const filtered = useMemo(
    () =>
      initialRows.filter((row) => {
        const byCategory = category ? row.category?.toLowerCase().includes(category.toLowerCase()) : true;
        const byDate = date ? row.date === date : true;
        return byCategory && byDate;
      }),
    [initialRows, category, date],
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2">
        <Input value={date} onChange={(event) => setDate(event.target.value)} placeholder={t("all.filterDate")} type="date" />
        <Input value={category} onChange={(event) => setCategory(event.target.value)} placeholder={t("all.filterCategory")} />
      </div>
      <div className="space-y-2">
        {filtered.map((row) => (
          <div key={row.id} className="rounded-lg border p-3 text-sm">
            <div className="font-medium">{row.merchant_clean}</div>
            <div>{row.date}</div>
            <div>
              {row.amount} {row.currency} · {row.category ?? t("all.uncategorized")}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
