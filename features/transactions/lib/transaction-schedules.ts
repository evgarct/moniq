import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfMonth,
  format,
  isAfter,
  isBefore,
  parseISO,
  startOfDay,
} from "date-fns";

import type { TransactionSchedule, TransactionScheduleFrequency, TransactionStatus } from "@/types/finance";

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

function getNextDate(
  date: Date,
  frequency: TransactionScheduleFrequency,
  anchorDate: Date,
  intervalWeeks: number,
) {
  if (frequency === "daily") {
    return addDays(date, 1);
  }

  if (frequency === "weekly") {
    return addWeeks(date, Math.max(1, intervalWeeks));
  }

  if (frequency === "yearly") {
    return clampMonthlyDate(anchorDate, addYears(date, 1));
  }

  if (frequency === "quarterly") {
    return clampMonthlyDate(anchorDate, addMonths(date, 3));
  }

  return clampMonthlyDate(anchorDate, addMonths(date, 1));
}

export function generateScheduleOccurrences(
  schedule: Pick<TransactionSchedule, "start_date" | "frequency" | "until_date"> & Partial<Pick<TransactionSchedule, "interval_weeks">>,
  horizonStart: string,
  horizonEnd: string,
): ScheduleOccurrence[] {
  const start = startOfDay(parseISO(schedule.start_date));
  const rangeStart = startOfDay(parseISO(horizonStart));
  const rangeEnd = startOfDay(parseISO(horizonEnd));
  const untilDate = schedule.until_date ? startOfDay(parseISO(schedule.until_date)) : null;
  const intervalWeeks = schedule.frequency === "weekly" ? schedule.interval_weeks ?? 1 : 1;

  if (isAfter(start, rangeEnd)) {
    return [];
  }

  const occurrences: ScheduleOccurrence[] = [];
  let current = start;

  while (isBefore(current, rangeStart)) {
    current = getNextDate(current, schedule.frequency, start, intervalWeeks);
  }

  while (!isAfter(current, rangeEnd)) {
    if (!untilDate || !isAfter(current, untilDate)) {
      occurrences.push({ occurrenceDate: formatDate(current) });
    }

    current = getNextDate(current, schedule.frequency, start, intervalWeeks);
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
