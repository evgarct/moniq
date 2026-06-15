"use client";

import { Plus, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { getPositionMarketValue, getPositionUnits } from "@/features/investments/lib/positions";
import { cn } from "@/lib/utils";
import type { InvestmentPosition, Transaction } from "@/types/finance";

export function InvestmentList({
  positions,
  transactions,
  selectedId,
  onSelect,
  onAdd,
}: {
  positions: InvestmentPosition[];
  transactions: Transaction[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
}) {
  const t = useTranslations("investments");
  return (
    <section>
      <div className="mb-2 flex items-center justify-between px-2">
        <h2 className="type-h6 text-muted-foreground">{t("title")}</h2>
        <Tooltip>
          <TooltipTrigger render={<Button variant="ghost" size="icon-sm" aria-label={t("actions.add")} />} onClick={onAdd}>
            <Plus />
          </TooltipTrigger>
          <TooltipContent>{t("actions.add")}</TooltipContent>
        </Tooltip>
      </div>
      {positions.length ? (
        <div className="flex flex-col">
          {positions.map((position) => {
            const units = getPositionUnits(position, transactions);
            const value = getPositionMarketValue(position, transactions);
            return (
              <button
                type="button"
                key={position.id}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 px-2 py-2 text-left hover:bg-secondary/50",
                  selectedId === position.id && "bg-secondary/60",
                )}
                onClick={() => onSelect(position.id)}
              >
                <TrendingUp className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate type-body-14 font-medium">{position.instrument.name}</span>
                  <span className="block type-body-12 text-muted-foreground">
                    {position.instrument.ticker} · {position.instrument.exchange} · {t("units", { value: String(units) })}
                  </span>
                </span>
                {value == null ? (
                  <span className="type-body-12 text-muted-foreground">{t("quoteUnavailable")}</span>
                ) : (
                  <MoneyAmount
                    amount={value}
                    currency={position.latest_quote!.currency}
                    display="absolute"
                    className="type-body-14 font-medium"
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="px-2 py-3 type-body-12 text-muted-foreground">{t("empty")}</p>
      )}
    </section>
  );
}
