import { describe, expect, it } from "vitest";

import {
  FINANCE_SNAPSHOT_RECURRING_HORIZON_MONTHS,
  getFinanceSnapshotScheduleHorizon,
  shouldPruneScheduleOccurrenceBeyondHorizon,
} from "@/features/finance/server/snapshot-horizon";

describe("finance snapshot recurring horizon", () => {
  it("uses an 18-month recurring materialization horizon", () => {
    expect(FINANCE_SNAPSHOT_RECURRING_HORIZON_MONTHS).toBe(18);
    expect(getFinanceSnapshotScheduleHorizon(new Date("2026-05-24T12:00:00Z"))).toEqual({
      horizonStart: "2026-05-01",
      horizonEnd: "2027-11-24",
    });
  });

  it("prunes only non-overridden planned schedule occurrences beyond the horizon", () => {
    const base = {
      schedule_id: "schedule-1",
      schedule_occurrence_date: "2027-11-25",
      status: "planned",
      is_schedule_override: false,
    };

    expect(shouldPruneScheduleOccurrenceBeyondHorizon(base, "2027-11-24")).toBe(true);
    expect(
      shouldPruneScheduleOccurrenceBeyondHorizon(
        { ...base, schedule_occurrence_date: "2027-11-24" },
        "2027-11-24",
      ),
    ).toBe(false);
    expect(shouldPruneScheduleOccurrenceBeyondHorizon({ ...base, is_schedule_override: true }, "2027-11-24")).toBe(
      false,
    );
    expect(shouldPruneScheduleOccurrenceBeyondHorizon({ ...base, status: "paid" }, "2027-11-24")).toBe(false);
    expect(shouldPruneScheduleOccurrenceBeyondHorizon({ ...base, status: "skipped" }, "2027-11-24")).toBe(false);
    expect(shouldPruneScheduleOccurrenceBeyondHorizon({ ...base, schedule_id: null }, "2027-11-24")).toBe(false);
  });
});
