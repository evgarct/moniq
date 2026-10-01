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
 * One envelope as a flat row: name and what is left (or by how much it is over) on the first line,
 * a thin plan track with "spent of planned" under it. Envelopes without a plan show what was spent.
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
  const planned = kind === "expense" && row.planned !== null && row.spent !== null;
  const over = row.status === "over";
  const ratio = planned && row.planned! > 0 ? row.spent! / row.planned! : 0;

  return (
    <div className={cn("flex items-center gap-1 rounded-sm transition-[background-color]", selected ? "bg-secondary" : "bg-transparent")}>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className={cn(
          "grid min-h-11 min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 rounded-sm px-1.5 py-2 text-left outline-none transition-[background-color] hover:bg-secondary/70 active:bg-secondary focus-visible:ring-2 focus-visible:ring-ring/25 sm:px-2.5",
          selected && "hover:bg-secondary",
        )}
      >
        <span className="flex min-w-0 items-center gap-2 sm:gap-2.5">
          <CategoryIcon icon={row.icon} glyphClassName={cn("size-4 shrink-0", selected ? "text-foreground" : "text-muted-foreground")} />
          <span className="type-h6 truncate">{row.name}</span>
        </span>

        <span className="type-h6 flex items-baseline justify-end gap-1.5">
          {row.spent === null ? (
            <span className="text-muted-foreground">—</span>
          ) : kind === "income" ? (
            <>
              <span className="type-body-12">{t("received")}</span>
              <MoneyAmount amount={row.spent} currency={currency} display="absolute" showMinorUnits={false} />
            </>
          ) : planned ? (
            <>
              <span className="type-body-12">{over ? t("over") : t("left")}</span>
              <MoneyAmount amount={Math.abs(row.left!)} currency={currency} display="absolute" tone={over ? "negative" : "default"} showMinorUnits={false} />
            </>
          ) : (
            <>
              <span className="type-body-12">{t("spent")}</span>
              <MoneyAmount amount={row.spent} currency={currency} display="absolute" tone="muted" showMinorUnits={false} />
            </>
          )}
        </span>

        {planned ? (
          <span className="col-span-2 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pl-6 sm:pl-[26px]">
            <ProgressTrack
              value={ratio}
              className="h-0.5"
              trackClassName="bg-border/55"
              fillClassName={over ? "bg-destructive" : row.status === "near" ? "bg-foreground" : "bg-foreground/62"}
            />
            <span className="type-body-12 whitespace-nowrap tabular-nums">
              {t("ofPlanned", {
                spent: formatMoneyNumber(row.spent!, currency, { showMinorUnits: false }),
                planned: formatMoneyNumber(row.planned!, currency, { showMinorUnits: false }),
              })}{" "}
              {getCurrencySymbol(currency)}
            </span>
          </span>
        ) : kind === "expense" ? (
          <span className="type-body-12 col-span-2 pl-6 sm:pl-[26px]">
            {row.spent === null ? t("noRate") : t("noPlan")}
          </span>
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
