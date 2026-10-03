"use client";

import { useTranslations } from "next-intl";

import { MoneyAmount } from "@/components/money-amount";
import { ProgressTrack } from "@/components/progress-track";
import type { EnvelopeBudgetSummary } from "@/features/budget/lib/envelope-budget";
import { formatMoneyNumber, getCurrencySymbol } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { CurrencyCode } from "@/types/currency";

function SummaryFigure({ label, swatch, children }: { label: string; swatch?: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="type-body-12 flex items-center gap-1.5 text-muted-foreground">
        {swatch ? <span aria-hidden className={cn("h-1 w-2.5 shrink-0 rounded-tight", swatch)} /> : null}
        {label}
      </dt>
      <dd className="type-h6 mt-0.5 truncate tabular-nums">{children}</dd>
    </div>
  );
}

/**
 * The month at a glance. The lead figure is where the planned envelopes end the month: plan minus what was spent
 * minus what is still planned. Under it the track splits the plan into spent (solid) and upcoming (light), then
 * the month's income (received and still expected) and the spend without a plan. All amounts are in the default
 * currency.
 */
export function BudgetSummary({
  summary,
  income,
  incomeUpcoming,
  currency,
}: {
  summary: EnvelopeBudgetSummary;
  income: number | null;
  incomeUpcoming: number | null;
  currency: CurrencyCode;
}) {
  const t = useTranslations("budget.summary");
  // Never show the actual balance under the month-end label: when an upcoming amount has no rate the forecast is unknown.
  const lead = summary.forecastLeft;
  const over = lead !== null && lead < 0;
  const ratesMissing = !summary.available || summary.upcoming === null;
  const plan = summary.available && summary.planned > 0 ? summary.planned : 0;
  const money = (amount: number | null, tone: "default" | "muted" | "negative" = "default") =>
    amount === null ? "—" : <MoneyAmount amount={amount} currency={currency} display="absolute" tone={tone} showMinorUnits={false} />;

  return (
    <section className="flex max-w-xl flex-col gap-3 px-4 pb-5 sm:px-6 lg:px-7" aria-label={t("forecastLeft")}>
      <div>
        <p className={cn("type-body-12", over ? "text-destructive" : "text-muted-foreground")}>{over ? t("forecastOver") : t("forecastLeft")}</p>
        <p className="type-h3 mt-0.5 tabular-nums">{money(lead === null ? null : Math.abs(lead), over ? "negative" : "default")}</p>
      </div>

      {plan ? (
        <ProgressTrack
          value={(summary.spentPlanned ?? 0) / plan}
          secondaryValue={(summary.upcomingPlanned ?? 0) / plan}
          className="h-1.5"
          trackClassName="bg-border/55"
          fillClassName={summary.left !== null && summary.left < 0 ? "bg-destructive" : "bg-foreground/70"}
          secondaryFillClassName={over ? "bg-destructive/40" : "bg-foreground/22"}
        />
      ) : null}

      <dl className="grid grid-cols-3 gap-3">
        <SummaryFigure label={t("spentLegend")} swatch="bg-foreground/70">{money(summary.spentPlanned)}</SummaryFigure>
        <SummaryFigure label={t("upcomingLegend")} swatch="bg-foreground/22">{money(summary.upcomingPlanned)}</SummaryFigure>
        <SummaryFigure label={t("planned")}>{money(summary.planned)}</SummaryFigure>
      </dl>

      <dl className="grid grid-cols-2 gap-3 border-t border-border/40 pt-3 type-body-12 text-muted-foreground">
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt>{t("income")}</dt>
          <dd className="tabular-nums text-foreground">
            {money(income)}
            {incomeUpcoming ? (
              <span className="text-muted-foreground"> {t("expected", { amount: `${formatMoneyNumber(incomeUpcoming, currency, { showMinorUnits: false })} ${getCurrencySymbol(currency)}` })}</span>
            ) : null}
          </dd>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <dt>{t("noPlan")}</dt>
          <dd className="tabular-nums text-foreground">{money(summary.unplanned)}</dd>
        </div>
      </dl>

      {ratesMissing ? <p className="type-body-12 text-muted-foreground">{t("missingRates")}</p> : null}
    </section>
  );
}
