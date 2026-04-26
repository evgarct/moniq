"use client";

import {
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  parseISO,
  startOfMonth,
  startOfWeek,
  subDays,
  subMonths,
} from "date-fns";
import { CalendarRange, ChevronLeft, ChevronRight } from "lucide-react";
import { useFormatter, useTranslations } from "next-intl";
import { useMemo, useState } from "react";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { calDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

function buildRangeLabel({
  startDate,
  endDate,
  emptyLabel,
  formatDate,
}: {
  startDate: string;
  endDate: string;
  emptyLabel: string;
  formatDate: ReturnType<typeof useFormatter>;
}) {
  if (!startDate || !endDate) {
    return emptyLabel;
  }

  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const currentYear = new Date().getFullYear();
  const includeYear = start.getFullYear() !== currentYear || end.getFullYear() !== currentYear;

  if (
    format(start, "yyyy-MM") === format(end, "yyyy-MM") &&
    isSameDay(start, startOfMonth(start)) &&
    isSameDay(end, endOfMonth(start))
  ) {
    return formatDate.dateTime(calDate(startDate), includeYear ? { month: "long", year: "numeric" } : { month: "long" });
  }

  if (isSameDay(start, end)) {
    return formatDate.dateTime(calDate(startDate), includeYear ? { month: "short", day: "numeric", year: "numeric" } : { month: "short", day: "numeric" });
  }

  return `${formatDate.dateTime(calDate(startDate), {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  })} - ${formatDate.dateTime(calDate(endDate), {
    month: "short",
    day: "numeric",
    ...(includeYear ? { year: "numeric" } : {}),
  })}`;
}

function toDateInputValue(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function clampRange(range: { startDate: string; endDate: string }) {
  if (!range.startDate) {
    return range;
  }

  if (!range.endDate || range.endDate < range.startDate) {
    return {
      startDate: range.startDate,
      endDate: range.startDate,
    };
  }

  return range;
}

function toDateRange(range: { startDate: string; endDate: string }): DateRange | undefined {
  if (!range.startDate || !range.endDate) {
    return undefined;
  }

  return {
    from: parseISO(range.startDate),
    to: parseISO(range.endDate),
  };
}

function buildPreviewRange(startDate: string, hoveredDate?: Date): DateRange {
  const start = parseISO(startDate);

  if (!hoveredDate) {
    return { from: start, to: start };
  }

  return hoveredDate < start
    ? { from: hoveredDate, to: start }
    : { from: start, to: hoveredDate };
}

export function DateRangePicker({
  startDate,
  endDate,
  defaultStartDate,
  onChange,
  triggerAriaLabel,
  emptyLabel,
  presets,
  initialOpen = false,
  className,
}: {
  startDate: string;
  endDate: string;
  defaultStartDate: string;
  onChange: (range: { startDate: string; endDate: string }) => void;
  triggerAriaLabel: string;
  emptyLabel: string;
  presets: {
    today: string;
    yesterday: string;
    last7Days: string;
    last14Days: string;
    last30Days: string;
    thisWeek: string;
    lastWeek: string;
    thisMonth: string;
    lastMonth: string;
  };
  initialOpen?: boolean;
  className?: string;
}) {
  const tr = useTranslations();
  const formatDate = useFormatter();
  const [open, setOpen] = useState(initialOpen);
  const [draftRange, setDraftRange] = useState({ startDate, endDate });
  const [pendingRangeStart, setPendingRangeStart] = useState<string | null>(null);
  const [hoveredDate, setHoveredDate] = useState<Date | undefined>(undefined);
  const [visibleMonth, setVisibleMonth] = useState(() => parseISO(defaultStartDate));
  const triggerLabel = useMemo(
    () => buildRangeLabel({ startDate, endDate, emptyLabel, formatDate }),
    [emptyLabel, endDate, formatDate, startDate],
  );
  const selectedRange = useMemo<DateRange | undefined>(
    () =>
      pendingRangeStart
        ? {
            from: parseISO(pendingRangeStart),
            to: undefined,
          }
        : toDateRange(draftRange),
    [draftRange, pendingRangeStart],
  );
  const pendingStartDate = pendingRangeStart ? parseISO(pendingRangeStart) : undefined;
  const previewRange = useMemo<DateRange | undefined>(
    () => (pendingRangeStart ? buildPreviewRange(pendingRangeStart, hoveredDate) : undefined),
    [hoveredDate, pendingRangeStart],
  );

  const presetRanges = useMemo(() => {
    const now = new Date();
    const today = toDateInputValue(now);
    const yesterday = toDateInputValue(subDays(now, 1));
    const thisWeekStart = toDateInputValue(startOfWeek(now, { weekStartsOn: 1 }));
    const thisWeekEnd = toDateInputValue(endOfWeek(now, { weekStartsOn: 1 }));
    const lastWeekDate = subDays(startOfWeek(now, { weekStartsOn: 1 }), 1);
    const lastWeekStart = toDateInputValue(startOfWeek(lastWeekDate, { weekStartsOn: 1 }));
    const lastWeekEnd = toDateInputValue(endOfWeek(lastWeekDate, { weekStartsOn: 1 }));
    const thisMonthStart = toDateInputValue(startOfMonth(now));
    const thisMonthEnd = toDateInputValue(endOfMonth(now));
    const lastMonthDate = subMonths(now, 1);
    const lastMonthStart = toDateInputValue(startOfMonth(lastMonthDate));
    const lastMonthEnd = toDateInputValue(endOfMonth(lastMonthDate));

    return [
      { key: "today", label: presets.today, range: { startDate: today, endDate: today } },
      { key: "yesterday", label: presets.yesterday, range: { startDate: yesterday, endDate: yesterday } },
      { key: "last7Days", label: presets.last7Days, range: { startDate: toDateInputValue(subDays(now, 6)), endDate: today } },
      { key: "last14Days", label: presets.last14Days, range: { startDate: toDateInputValue(subDays(now, 13)), endDate: today } },
      { key: "last30Days", label: presets.last30Days, range: { startDate: toDateInputValue(subDays(now, 29)), endDate: today } },
      { key: "thisWeek", label: presets.thisWeek, range: { startDate: thisWeekStart, endDate: thisWeekEnd } },
      { key: "lastWeek", label: presets.lastWeek, range: { startDate: lastWeekStart, endDate: lastWeekEnd } },
      { key: "thisMonth", label: presets.thisMonth, range: { startDate: thisMonthStart, endDate: thisMonthEnd } },
      { key: "lastMonth", label: presets.lastMonth, range: { startDate: lastMonthStart, endDate: lastMonthEnd } },
    ];
  }, [presets]);

  function applyRange(range: { startDate: string; endDate: string }) {
    onChange(clampRange(range));
    setHoveredDate(undefined);
    setOpen(false);
  }

  function handleDaySelect(day: Date) {
    const value = format(day, "yyyy-MM-dd");

    if (!pendingRangeStart) {
      setDraftRange({ startDate: value, endDate: value });
      setPendingRangeStart(value);
      setHoveredDate(day);
      return;
    }

    const nextRange =
      value < pendingRangeStart
        ? { startDate: value, endDate: pendingRangeStart }
        : { startDate: pendingRangeStart, endDate: value };

    setPendingRangeStart(null);
    setHoveredDate(undefined);
    setDraftRange(nextRange);
    applyRange(nextRange);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setDraftRange({ startDate, endDate });
          setPendingRangeStart(null);
          setHoveredDate(undefined);
          setVisibleMonth(parseISO(startDate || defaultStartDate));
        }

        setOpen(nextOpen);
      }}
    >
      <div className={cn("relative", className)}>
        <PopoverTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className="h-8 w-auto max-w-full justify-start rounded-md bg-transparent px-2.5 text-[13px] font-medium text-foreground hover:bg-[#ece8e1] active:bg-[#e6e1d9]"
              aria-expanded={open}
              aria-label={triggerAriaLabel}
            />
          }
        >
          <span className="flex min-w-0 items-center gap-2 truncate">
            <CalendarRange className="size-4 shrink-0 text-muted-foreground" />
            <span className="truncate">{triggerLabel}</span>
          </span>
        </PopoverTrigger>

        <PopoverContent
          align="start"
          sideOffset={8}
          className="w-fit max-w-[92vw] rounded-md p-0 sm:align-end"
        >
          <div className="grid items-center gap-2 px-4 py-4 sm:grid-cols-[auto_104px]">
            <div className="w-fit self-center">
              <div className="relative pb-2">
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute left-0 top-1/2 -translate-y-1/2 rounded-md bg-transparent text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground active:bg-[#e6e1d9]"
                        aria-label={tr("common.actions.previous")}
                      />
                    }
                    onClick={() => setVisibleMonth((current) => subMonths(current, 1))}
                  >
                    <ChevronLeft className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>{tr("common.actions.previous")}</TooltipContent>
                </Tooltip>

                <div className="grid grid-cols-2 items-center gap-6 px-8">
                  <p className="truncate text-center text-sm font-medium tracking-[-0.02em] text-foreground">
                    {formatDate.dateTime(calDate(visibleMonth), { month: "long", year: "numeric" })}
                  </p>
                  <p className="truncate text-center text-sm font-medium tracking-[-0.02em] text-foreground">
                    {formatDate.dateTime(calDate(addMonths(visibleMonth, 1)), { month: "long", year: "numeric" })}
                  </p>
                </div>

                <Tooltip>
                  <TooltipTrigger
                    render={
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="absolute right-0 top-1/2 -translate-y-1/2 rounded-md bg-transparent text-muted-foreground hover:bg-[#ece8e1] hover:text-foreground active:bg-[#e6e1d9]"
                        aria-label={tr("common.actions.next")}
                      />
                    }
                    onClick={() => setVisibleMonth((current) => addMonths(current, 1))}
                  >
                    <ChevronRight className="size-4" />
                  </TooltipTrigger>
                  <TooltipContent>{tr("common.actions.next")}</TooltipContent>
                </Tooltip>
              </div>

              {pendingStartDate ? (
                <Calendar
                  key={`pending-${pendingRangeStart}-${hoveredDate ? format(hoveredDate, "yyyy-MM-dd") : "none"}`}
                  mode="range"
                  selected={previewRange}
                  onDayClick={handleDaySelect}
                  onDayMouseEnter={setHoveredDate}
                  onDayFocus={setHoveredDate}
                  weekStartsOn={1}
                  month={visibleMonth}
                  onMonthChange={setVisibleMonth}
                  hideNavigation
                  numberOfMonths={2}
                  classNames={{
                    month_caption: "hidden",
                  }}
                  className="rounded-md [--cell-size:1.875rem]"
                  aria-label={triggerAriaLabel}
                />
              ) : (
                <Calendar
                  key={`range-${draftRange.startDate}-${draftRange.endDate}`}
                  mode="range"
                  selected={selectedRange}
                  onDayClick={handleDaySelect}
                  weekStartsOn={1}
                  month={visibleMonth}
                  onMonthChange={setVisibleMonth}
                  hideNavigation
                  numberOfMonths={2}
                  classNames={{
                    month_caption: "hidden",
                  }}
                  className="rounded-md [--cell-size:1.875rem]"
                  aria-label={triggerAriaLabel}
                />
              )}
            </div>

            <div className="grid gap-0.5 self-start">
              {presetRanges.map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  variant="ghost"
                  className="h-7 justify-start rounded-md px-2 text-[12px] font-normal text-foreground hover:bg-[#ece8e1] active:bg-[#e6e1d9]"
                  onClick={() => applyRange(preset.range)}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </div>
    </Popover>
  );
}
