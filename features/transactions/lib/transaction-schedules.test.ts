import { describe, expect, it } from "vitest";

import { generateScheduleOccurrences, isSettledTransactionStatus, isVisibleTransactionStatus } from "@/features/transactions/lib/transaction-schedules";

describe("transaction-schedules", () => {
  it("generates daily occurrences inside the requested horizon", () => {
    expect(
      generateScheduleOccurrences(
        {
          start_date: "2026-03-29",
          frequency: "daily",
          until_date: null,
        },
        "2026-03-31",
        "2026-04-02",
      ),
    ).toEqual([
      { occurrenceDate: "2026-03-31" },
      { occurrenceDate: "2026-04-01" },
      { occurrenceDate: "2026-04-02" },
    ]);
  });

  it("keeps weekly cadence anchored to the original date", () => {
    expect(
      generateScheduleOccurrences(
        {
          start_date: "2026-03-03",
          frequency: "weekly",
          until_date: null,
        },
        "2026-03-10",
        "2026-03-31",
      ),
    ).toEqual([
      { occurrenceDate: "2026-03-10" },
      { occurrenceDate: "2026-03-17" },
      { occurrenceDate: "2026-03-24" },
      { occurrenceDate: "2026-03-31" },
    ]);
  });

  it("clamps monthly dates to the end of shorter months", () => {
    expect(
      generateScheduleOccurrences(
        {
          start_date: "2026-01-31",
          frequency: "monthly",
          until_date: null,
        },
        "2026-02-01",
        "2026-04-30",
      ),
    ).toEqual([
      { occurrenceDate: "2026-02-28" },
      { occurrenceDate: "2026-03-31" },
      { occurrenceDate: "2026-04-30" },
    ]);
  });

  it("stops generating after the until date", () => {
    expect(
      generateScheduleOccurrences(
        {
          start_date: "2026-03-01",
          frequency: "weekly",
          until_date: "2026-03-20",
        },
        "2026-03-01",
        "2026-03-31",
      ),
    ).toEqual([
      { occurrenceDate: "2026-03-01" },
      { occurrenceDate: "2026-03-08" },
      { occurrenceDate: "2026-03-15" },
    ]);
  });

  it("treats skipped transactions as hidden and paid transactions as settled", () => {
    expect(isVisibleTransactionStatus("planned")).toBe(true);
    expect(isVisibleTransactionStatus("paid")).toBe(true);
    expect(isVisibleTransactionStatus("skipped")).toBe(false);
    expect(isSettledTransactionStatus("paid")).toBe(true);
    expect(isSettledTransactionStatus("planned")).toBe(false);
  });
});
