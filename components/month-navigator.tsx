"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { calDate } from "@/lib/formatters";

export function MonthNavigator({
  month,
  onPrevious,
  onNext,
  onToday,
}: {
  month: Date;
  onPrevious: () => void;
  onNext: () => void;
  onToday: () => void;
}) {
  const t = useTranslations();
  const formatDate = useFormatter();

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-heading text-xl font-semibold">
          {formatDate.dateTime(calDate(month), { month: "long", year: "numeric" })}
        </p>
        <p className="text-sm text-muted-foreground">{t("calendar.navigator.description")}</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={onToday}>
          {t("common.actions.today")}
        </Button>
        <Button variant="outline" size="icon-sm" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
