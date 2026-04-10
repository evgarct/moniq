"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BankTransaction = {
  id: string;
  amount: number;
  currency: string;
  date: string;
  merchant_clean: string;
  category: string | null;
  status: "draft" | "confirmed" | "edited";
};

const categories = ["food", "transport", "housing", "health", "other"];

export function BankingInboxClient({ initialRows }: { initialRows: BankTransaction[] }) {
  const t = useTranslations("banking");
  const [rows, setRows] = useState<BankTransaction[]>(initialRows);
  const [selected, setSelected] = useState<Record<string, boolean>>({});

  const selectedIds = useMemo(() => Object.keys(selected).filter((id) => selected[id]), [selected]);

  async function loadDrafts() {
    const response = await fetch("/api/open-banking/transactions?status=draft");
    const data = (await response.json()) as BankTransaction[];
    setRows(data);
  }

  async function patchRow(id: string, payload: Partial<BankTransaction>) {
    await fetch(`/api/open-banking/transactions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    await loadDrafts();
  }

  async function confirmSelected() {
    if (selectedIds.length === 0) {
      return;
    }

    await fetch("/api/open-banking/transactions/batch-confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selectedIds }),
    });

    setSelected({});
    await loadDrafts();
  }

  async function applyCategoryToAll(category: string) {
    await Promise.all(selectedIds.map((id) => patchRow(id, { category, status: "edited" })));
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={loadDrafts}>{t("inbox.refresh")}</Button>
        <Select onValueChange={applyCategoryToAll}>
          <SelectTrigger className="w-[220px]">
            <SelectValue placeholder={t("inbox.batchCategory")} />
          </SelectTrigger>
          <SelectContent>
            {categories.map((category) => (
              <SelectItem key={category} value={category}>
                {category}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={confirmSelected}>{t("inbox.confirmAll")}</Button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[24px_1fr_120px_180px_160px] items-center gap-2 rounded-lg border p-2">
            <input
              type="checkbox"
              checked={Boolean(selected[row.id])}
              onChange={(event) => setSelected((prev) => ({ ...prev, [row.id]: event.target.checked }))}
              aria-label={t("inbox.selectTransaction")}
            />
            <Input
              value={row.merchant_clean}
              onChange={(event) => {
                const value = event.target.value;
                setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, merchant_clean: value } : item)));
              }}
              onBlur={() => patchRow(row.id, { merchant_clean: row.merchant_clean, status: "edited" })}
            />
            <span className="text-sm">
              {row.amount} {row.currency}
            </span>
            <Select
              value={row.category ?? "other"}
              onValueChange={(value) => patchRow(row.id, { category: value, status: "edited" })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category} value={category}>
                    {category}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => patchRow(row.id, { status: "confirmed" })}>
                {t("inbox.confirm")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => patchRow(row.id, { status: "edited" })}>
                {t("inbox.edit")}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
