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
  editing = false,
}: {
  positions: InvestmentPosition[];
  transactions: Transaction[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  editing?: boolean;
}) {
  const t = useTranslations("investments");

  return (
    <section className="flex flex-col gap-2 sm:gap-2.5">
      <div className="flex items-center justify-between gap-3 px-1.5 sm:px-2.5">
        <h3 className="font-heading text-[20px] leading-[1.12] tracking-[-0.028em] text-foreground sm:type-h3">
          {t("title")}
        </h3>
        <div className="flex h-8 w-8 items-center justify-center">
          {editing ? (
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    className="bg-transparent text-muted-foreground hover:bg-secondary/70 hover:text-foreground active:bg-secondary"
                    aria-label={t("actions.add")}
                  />
                }
                onClick={onAdd}
              >
                <Plus />
              </TooltipTrigger>
              <TooltipContent>{t("actions.add")}</TooltipContent>
            </Tooltip>
          ) : null}
        </div>
      </div>

      {positions.length ? (
        <div className="flex flex-col gap-0.5 sm:gap-1">
          {positions.map((position) => {
            const units = getPositionUnits(position, transactions);
            const value = getPositionMarketValue(position, transactions);

            return (
              <button
                type="button"
                key={position.id}
                className={cn(
                  "flex min-h-14 w-full items-center gap-2 rounded-sm px-1.5 py-1.5 text-left transition-[background-color] hover:bg-secondary/70 active:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 sm:gap-2.5 sm:px-2.5 sm:py-2.5",
                  selectedId === position.id && "bg-secondary/60",
                )}
                onClick={() => onSelect(position.id)}
              >
                <TrendingUp className="size-[18px] shrink-0 text-muted-foreground" strokeWidth={1.75} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] leading-[18px] font-medium tracking-[0.01em] text-foreground sm:type-h6">
                    {position.instrument.name}
                  </span>
                  <span className="block truncate type-body-12 text-muted-foreground">
                    {position.instrument.ticker} {"\u00b7"} {position.instrument.exchange} {"\u00b7"} {t("units", { value: String(units) })}
                  </span>
                </span>
                {value == null ? (
                  <span className="shrink-0 type-body-12 text-muted-foreground">{t("quoteUnavailable")}</span>
                ) : (
                  <MoneyAmount
                    amount={value}
                    currency={position.latest_quote!.currency}
                    display="absolute"
                    className="shrink-0 type-body-14 font-medium"
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <p className="px-1.5 py-1 text-[13px] leading-5 text-muted-foreground sm:type-body-14 sm:px-2.5">
          {t("empty")}
        </p>
      )}
    </section>
  );
}
