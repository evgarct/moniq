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

  it("generates weekly occurrences every n weeks", () => {
    expect(
      generateScheduleOccurrences(
        {
          start_date: "2026-03-03",
          frequency: "weekly",
          interval_weeks: 2,
          until_date: null,
        },
        "2026-03-01",
        "2026-04-14",
      ),
    ).toEqual([
      { occurrenceDate: "2026-03-03" },
      { occurrenceDate: "2026-03-17" },
      { occurrenceDate: "2026-03-31" },
      { occurrenceDate: "2026-04-14" },
    ]);
  });

  it("skips ahead to the first weekly interval inside the horizon", () => {
    expect(
      generateScheduleOccurrences(
        {
          start_date: "2026-03-03",
          frequency: "weekly",
          interval_weeks: 3,
          until_date: null,
        },
        "2026-04-01",
        "2026-05-20",
      ),
    ).toEqual([
      { occurrenceDate: "2026-04-14" },
      { occurrenceDate: "2026-05-05" },
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

  it("generates yearly occurrences", () => {
    expect(
      generateScheduleOccurrences(
        {
          start_date: "2024-05-20",
          frequency: "yearly",
          until_date: null,
        },
        "2026-01-01",
        "2028-12-31",
      ),
    ).toEqual([
      { occurrenceDate: "2026-05-20" },
      { occurrenceDate: "2027-05-20" },
      { occurrenceDate: "2028-05-20" },
    ]);
  });

  it("clamps yearly leap-day occurrences to February 28 in non-leap years", () => {
    expect(
      generateScheduleOccurrences(
        {
          start_date: "2024-02-29",
          frequency: "yearly",
          until_date: null,
        },
        "2025-01-01",
        "2028-12-31",
      ),
    ).toEqual([
      { occurrenceDate: "2025-02-28" },
      { occurrenceDate: "2026-02-28" },
      { occurrenceDate: "2027-02-28" },
      { occurrenceDate: "2028-02-29" },
    ]);
  });

  it("includes the first monthly occurrence when the range starts earlier in the same month", () => {
    expect(
      generateScheduleOccurrences(
        {
          start_date: "2026-05-10",
          frequency: "monthly",
          until_date: null,
        },
        "2026-05-01",
        "2026-06-30",
      ),
    ).toEqual([
      { occurrenceDate: "2026-05-10" },
      { occurrenceDate: "2026-06-10" },
    ]);
  });

  it("stops generating after the until date", () => {
    expect(
      generateScheduleOccurrences(
        {
          start_date: "2026-03-01",
          frequency: "weekly",
          interval_weeks: 2,
          until_date: "2026-03-20",
        },
        "2026-03-01",
        "2026-03-31",
      ),
    ).toEqual([
      { occurrenceDate: "2026-03-01" },
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
