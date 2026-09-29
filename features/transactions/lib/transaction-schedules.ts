import {
  addDays,
  addMonths,
  addWeeks,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";

import type { TransactionSchedule, TransactionStatus } from "@/types/finance";

import { resolveScheduleInterval, type ScheduleInterval } from "./schedule-interval";

export { findScheduleFrequency, resolveScheduleInterval, type ScheduleInterval } from "./schedule-interval";

export type ScheduleOccurrence = {
  occurrenceDate: string;
};

function formatDate(date: Date) {
  return format(date, "yyyy-MM-dd");
}

function clampMonthlyDate(anchor: Date, target: Date) {
  return new Date(
    target.getFullYear(),
    target.getMonth(),
    Math.min(anchor.getDate(), endOfMonth(target).getDate()),
  );
}

function getNextDate(date: Date, interval: ScheduleInterval, anchorDate: Date) {
  if (interval.unit === "day") {
    return addDays(date, interval.count);
  }

  if (interval.unit === "week") {
    return addWeeks(date, interval.count);
  }

  return clampMonthlyDate(anchorDate, addMonths(date, interval.count));
}

export function generateScheduleOccurrences(
  schedule: Pick<TransactionSchedule, "start_date" | "frequency" | "until_date"> &
    Partial<Pick<TransactionSchedule, "interval_count" | "interval_unit">>,
  horizonStart: string,
  horizonEnd: string,
): ScheduleOccurrence[] {
  const start = startOfDay(parseISO(schedule.start_date));
  const rangeStart = startOfDay(parseISO(horizonStart));
  const rangeEnd = startOfDay(parseISO(horizonEnd));
  const untilDate = schedule.until_date ? startOfDay(parseISO(schedule.until_date)) : null;
  const interval = resolveScheduleInterval(schedule);

  if (isAfter(start, rangeEnd)) {
    return [];
  }

  const occurrences: ScheduleOccurrence[] = [];
  let current = start;

  while (isBefore(current, rangeStart)) {
    current = getNextDate(current, interval, start);
  }

  while (!isAfter(current, rangeEnd)) {
    if (!untilDate || !isAfter(current, untilDate)) {
      occurrences.push({ occurrenceDate: formatDate(current) });
    }

    current = getNextDate(current, interval, start);
  }

  return occurrences;
}

export function isSkippableTransactionStatus(status: TransactionStatus) {
  return status === "planned";
}

export function isVisibleTransactionStatus(status: TransactionStatus) {
  return status !== "skipped";
}

export function isSettledTransactionStatus(status: TransactionStatus) {
  return status === "paid";
}
