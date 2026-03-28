"use client";

import { format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

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
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-heading text-xl font-semibold">{format(month, "MMMM yyyy")}</p>
        <p className="text-sm text-muted-foreground">Select a day to inspect related transactions.</p>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="outline" size="icon-sm" onClick={onPrevious}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <Button variant="outline" onClick={onToday}>
          Today
        </Button>
        <Button variant="outline" size="icon-sm" onClick={onNext}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
