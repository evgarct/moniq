"use client";

import { useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { ProgressTrack } from "@/components/progress-track";
import type { EnvelopeBudgetSummary } from "@/features/budget/lib/envelope-budget";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";

function SummaryFigure({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="type-body-12 text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 truncate text-[17px] leading-6 font-medium tabular-nums sm:text-[20px] sm:leading-7", className)}>{children}</dd>
    </div>
  );
}

/**
 * The month at a glance: planned, spent and left for the envelopes that have a plan, with the
 * income of the month and the spend that has no plan underneath. All amounts are in the default currency.
 */
export function BudgetSummary({
  summary,
  income,
  currency,
}: {
  summary: EnvelopeBudgetSummary;
  income: number | null;
  currency: CurrencyCode;
}) {
  const t = useTranslations("budget.summary");
  const envelopeT = useTranslations("budget.envelope");
  const over = summary.left !== null && summary.left < 0;
  const ratio = summary.available && summary.planned > 0 ? (summary.spentPlanned ?? 0) / summary.planned : 0;
  const money = (amount: number | null, tone: "default" | "muted" | "negative" = "default") =>
    amount === null ? "—" : <MoneyAmount amount={amount} currency={currency} display="absolute" tone={tone} showMinorUnits={false} />;

  return (
    <section className="flex max-w-xl flex-col gap-3 px-4 pb-4 sm:px-6 lg:px-7">
      <dl className="grid grid-cols-3 gap-3">
        <SummaryFigure label={t("planned")}>{money(summary.planned)}</SummaryFigure>
        <SummaryFigure label={t("spent")}>{money(summary.spentPlanned)}</SummaryFigure>
        <SummaryFigure label={over ? envelopeT("over") : t("left")}>{money(summary.left === null ? null : Math.abs(summary.left), over ? "negative" : "default")}</SummaryFigure>
      </dl>

      {summary.planned > 0 ? (
        <ProgressTrack
          value={ratio}
          className="h-1"
          trackClassName="bg-border/55"
          fillClassName={over ? "bg-destructive" : "bg-foreground/62"}
        />
      ) : null}

      <dl className="grid grid-cols-2 gap-3 type-body-12 text-muted-foreground">
        <div className="flex items-baseline justify-between gap-2">
          <dt>{t("income")}</dt>
          <dd className="tabular-nums text-foreground">{money(income)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt>{t("noPlan")}</dt>
          <dd className="tabular-nums text-foreground">{money(summary.unplanned)}</dd>
        </div>
      </dl>

      {!summary.available ? <p className="type-body-12 text-muted-foreground">{t("missingRates")}</p> : null}
    </section>
  );
}
