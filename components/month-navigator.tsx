"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { PageToolbarButton, pageToolbarButtonClassName } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MonthNavigator({
  month,
  onPrevious,
  onNext,
  onToday,
  label,
  description,
  className,
}: {
  month: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
  label?: string;
  description?: string;
  className?: string;
}) {
  const t = useTranslations();
  const commonActionsT = useTranslations("common.actions");
  const formatDate = useFormatter();

  return (
    <div className={cn("flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between", className)}>
      <div className="min-w-0">
        {label ? (
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</p>
        ) : null}
        <p className="mt-1 font-heading text-xl font-semibold">
          {formatDate.dateTime(month, { month: "long", year: "numeric" })}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {description ?? t("calendar.navigator.description")}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <PageToolbarButton aria-label={commonActionsT("previous")} onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" />
        </PageToolbarButton>
        <Button variant="ghost" size="sm" className={cn(pageToolbarButtonClassName, "px-3")} onClick={onToday}>
          {t("common.actions.today")}
        </Button>
        <PageToolbarButton aria-label={commonActionsT("next")} onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </PageToolbarButton>
      </div>
    </div>
  );
}
