import type { ScheduleIntervalUnit, TransactionSchedule, TransactionScheduleFrequency } from "@/types/finance";

export type ScheduleInterval = { count: number; unit: ScheduleIntervalUnit };

const PRESET_INTERVALS: Record<Exclude<TransactionScheduleFrequency, "custom">, ScheduleInterval> = {
  daily: { count: 1, unit: "day" },
  weekly: { count: 1, unit: "week" },
  monthly: { count: 1, unit: "month" },
  quarterly: { count: 3, unit: "month" },
  yearly: { count: 12, unit: "month" },
};

/**
 * The canonical "every N units" cadence of a schedule. Presets are labels for a fixed
 * pair; `custom` carries its own. Mirrors the SQL normalisation in
 * `mcp_normalize_recurring_schedule`.
 */
export function resolveScheduleInterval(
  schedule: Pick<TransactionSchedule, "frequency"> & Partial<Pick<TransactionSchedule, "interval_count" | "interval_unit">>,
): ScheduleInterval {
  if (schedule.frequency !== "custom") {
    return PRESET_INTERVALS[schedule.frequency];
  }
  return {
    count: Math.max(1, Math.floor(schedule.interval_count ?? 1)),
    unit: schedule.interval_unit ?? "day",
  };
}

/** Returns the preset that exactly matches this cadence, or `custom`. */
export function findScheduleFrequency(interval: ScheduleInterval): TransactionScheduleFrequency {
  for (const [frequency, preset] of Object.entries(PRESET_INTERVALS)) {
    if (preset.count === interval.count && preset.unit === interval.unit) {
      return frequency as TransactionScheduleFrequency;
    }
  }
  return "custom";
}
