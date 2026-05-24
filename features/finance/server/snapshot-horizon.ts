import { addMonths, format, startOfMonth, startOfToday } from "date-fns";

export const FINANCE_SNAPSHOT_RECURRING_HORIZON_MONTHS = 18;

export type SnapshotSchedulePruneCandidate = {
  schedule_id: string | null;
  schedule_occurrence_date: string | null;
  status: string;
  is_schedule_override: boolean | null;
};

export function getFinanceSnapshotScheduleHorizon(today = startOfToday()) {
  return {
    horizonStart: format(startOfMonth(today), "yyyy-MM-dd"),
    horizonEnd: format(addMonths(today, FINANCE_SNAPSHOT_RECURRING_HORIZON_MONTHS), "yyyy-MM-dd"),
  };
}

export function shouldPruneScheduleOccurrenceBeyondHorizon(
  row: SnapshotSchedulePruneCandidate,
  horizonEnd: string,
) {
  return Boolean(
    row.schedule_id &&
      row.schedule_occurrence_date &&
      row.schedule_occurrence_date > horizonEnd &&
      row.status === "planned" &&
      row.is_schedule_override === false,
  );
}
