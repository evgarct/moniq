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

function getNextDate(date: Date, frequency: TransactionScheduleFrequency, anchorDate: Date) {
  if (frequency === "daily") {
    return addDays(date, 1);
  }

  if (frequency === "weekly") {
    return addWeeks(date, 1);
  }

  return clampMonthlyDate(anchorDate, addMonths(date, 1));
}

export function generateScheduleOccurrences(
  schedule: Pick<TransactionSchedule, "start_date" | "frequency" | "until_date">,
  horizonStart: string,
  horizonEnd: string,
): ScheduleOccurrence[] {
  const start = startOfDay(parseISO(schedule.start_date));
  const rangeStart = startOfDay(parseISO(horizonStart));
  const rangeEnd = startOfDay(parseISO(horizonEnd));
  const untilDate = schedule.until_date ? startOfDay(parseISO(schedule.until_date)) : null;

  if (isAfter(start, rangeEnd)) {
    return [];
  }

  const occurrences: ScheduleOccurrence[] = [];
  let current = start;

  while (isBefore(current, rangeStart)) {
    current = getNextDate(current, schedule.frequency, start);
  }

  while (!isAfter(current, rangeEnd)) {
    if (!untilDate || !isAfter(current, untilDate)) {
      occurrences.push({ occurrenceDate: formatDate(current) });
    }

    current = getNextDate(current, schedule.frequency, start);
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
