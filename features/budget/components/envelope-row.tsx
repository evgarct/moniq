"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";

import { CategoryIcon } from "@/components/category-icon";
import { MoneyAmount } from "@/components/money-amount";
import { ProgressTrack } from "@/components/progress-track";
import { Button } from "@/components/ui/button";
import type { EnvelopeBudgetRow } from "@/features/budget/lib/envelope-budget";
import { formatMoneyNumber, getCurrencySymbol } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";

/**
 * One envelope as a flat row. The first line is the name and where the envelope ends the month: what will be left
 * once the planned transactions are paid (or by how much it is, or will be, over). Under it a track shows the
 * actual spend (solid) and the upcoming spend (light) against the plan, with "spent of planned · +upcoming".
 * Envelopes without a plan show what was spent and what is still planned.
 */
export function EnvelopeRow({
  row,
  currency,
  selected,
  kind = "expense",
  editMode = false,
  onSelect,
  onDelete,
}: {
  row: EnvelopeBudgetRow;
  currency: CurrencyCode;
  selected: boolean;
  kind?: "expense" | "income";
  editMode?: boolean;
  onSelect: () => void;
  onDelete?: () => void;
}) {
  const t = useTranslations("budget.envelope");
  const summaryT = useTranslations("budget.summary");
  const hasPlan = kind === "expense" && row.planned !== null && row.spent !== null;
  const upcoming = row.upcoming ?? 0;
  // Prefer the month-end figure; fall back to the actual figure when the upcoming amount has no rate.
  const remaining = row.forecastLeft ?? row.left;
  const over = row.status === "over";
  const willBeOver = row.atRisk;
  const negative = over || willBeOver;
  const plan = hasPlan && row.planned! > 0 ? row.planned! : 0;
  const money = (amount: number) => formatMoneyNumber(amount, currency, { showMinorUnits: false });
  const symbol = getCurrencySymbol(currency);

  return (
    <div className={cn("flex items-center gap-1 rounded-sm transition-[background-color]", selected ? "bg-secondary" : "bg-transparent")}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "grid min-h-11 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-sm px-1.5 py-2.5 text-left outline-none transition-[background-color] hover:bg-secondary/70 active:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/25 sm:px-2.5",
          selected && "hover:bg-secondary",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <CategoryIcon icon={row.icon} glyphClassName={cn("size-4 shrink-0", selected ? "text-foreground" : "text-muted-foreground")} />
          <span className="type-h6 truncate">{row.name}</span>
        </span>

        <span className="type-h6 flex items-baseline justify-end gap-1.5 whitespace-nowrap">
          {row.spent === null ? (
            <span className="text-muted-foreground">—</span>
          ) : kind === "income" ? (
            <>
              <span className="type-body-12 text-muted-foreground">{t("received")}</span>
              <MoneyAmount amount={row.spent} currency={currency} display="absolute" showMinorUnits={false} />
            </>
          ) : hasPlan && remaining !== null ? (
            <>
              <span className={cn("type-body-12", negative ? "text-destructive" : "text-muted-foreground")}>
                {over ? t("over") : willBeOver ? t("willBeOver") : t("left")}
              </span>
              <MoneyAmount amount={Math.abs(remaining)} currency={currency} display="absolute" tone={negative ? "negative" : "default"} showMinorUnits={false} />
            </>
          ) : (
            <>
              <span className="type-body-12 text-muted-foreground">{t("spent")}</span>
              <MoneyAmount amount={row.spent} currency={currency} display="absolute" showMinorUnits={false} />
            </>
          )}
        </span>

        {hasPlan ? (
          // Full-width track so envelopes compare at a glance; the figures sit on their own line under it.
          <span className="col-span-2 flex flex-col gap-1.5 pl-6 sm:pl-[26px]">
            <ProgressTrack
              value={plan ? row.spent! / plan : 0}
              secondaryValue={plan ? upcoming / plan : 0}
              className="h-1"
              trackClassName="bg-border/55"
              fillClassName={over ? "bg-destructive" : "bg-foreground/70"}
              secondaryFillClassName={willBeOver ? "bg-destructive/40" : "bg-foreground/22"}
            />
            <span className="type-body-12 flex justify-between gap-3 tabular-nums text-muted-foreground">
              <span className="truncate">{t("ofPlanned", { spent: money(row.spent!), planned: money(row.planned!) })} {symbol}</span>
              {row.upcoming === null ? (
                // The upcoming amount needs a missing rate: the right-hand figure is the actual balance, not month end.
                <span className="whitespace-nowrap">{t("noRate")}</span>
              ) : upcoming > 0 ? (
                <span className="whitespace-nowrap text-foreground/80">{t("upcoming", { amount: money(upcoming) })}</span>
              ) : null}
            </span>
          </span>
        ) : row.spent === null ? (
          <span className="type-body-12 col-span-2 pl-6 text-muted-foreground sm:pl-[26px]">{t("noRate")}</span>
        ) : upcoming > 0 ? (
          <span className="type-body-12 col-span-2 pl-6 tabular-nums text-foreground/80 sm:pl-[26px]">
            {kind === "income" ? summaryT("expected", { amount: `${money(upcoming)} ${symbol}` }) : `${t("upcoming", { amount: money(upcoming) })} ${symbol}`}
          </span>
        ) : kind === "expense" ? (
          <span className="type-body-12 col-span-2 pl-6 text-muted-foreground sm:pl-[26px]">{t("noPlan")}</span>
        ) : null}
      </button>

      {editMode && onDelete ? (
        <Button type="button" variant="ghost" size="icon" onClick={onDelete} aria-label={t("delete", { name: row.name })} className="size-9 shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive">
          <Trash2 className="size-4" />
        </Button>
      ) : null}
    </div>
  );
}
