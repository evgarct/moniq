import { describe, expect, it } from "vitest";

import {
  findScheduleFrequency,
  generateScheduleOccurrences,
  isSettledTransactionStatus,
  isVisibleTransactionStatus,
  resolveScheduleInterval,
} from "@/features/transactions/lib/transaction-schedules";

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
          frequency: "custom",
          interval_count: 2,
          interval_unit: "week",
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
          frequency: "custom",
          interval_count: 3,
          interval_unit: "week",
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

  it("generates quarterly occurrences", () => {
    expect(
      generateScheduleOccurrences(
        {
          start_date: "2026-01-15",
          frequency: "quarterly",
          until_date: null,
        },
        "2026-01-01",
        "2026-10-31",
      ),
    ).toEqual([
      { occurrenceDate: "2026-01-15" },
      { occurrenceDate: "2026-04-15" },
      { occurrenceDate: "2026-07-15" },
      { occurrenceDate: "2026-10-15" },
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
          frequency: "custom",
          interval_count: 2,
          interval_unit: "week",
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

  it("generates a custom cadence every 9 days", () => {
    expect(
      generateScheduleOccurrences(
        { start_date: "2026-09-29", frequency: "custom", interval_count: 9, interval_unit: "day", until_date: null },
        "2026-09-01",
        "2026-11-30",
      ).map((occurrence) => occurrence.occurrenceDate),
    ).toEqual([
      "2026-09-29",
      "2026-10-08",
      "2026-10-17",
      "2026-10-26",
      "2026-11-04",
      "2026-11-13",
      "2026-11-22",
    ]);
  });

  it("generates a custom cadence every 3 days and skips ahead inside the horizon", () => {
    expect(
      generateScheduleOccurrences(
        { start_date: "2026-01-01", frequency: "custom", interval_count: 3, interval_unit: "day", until_date: null },
        "2026-01-10",
        "2026-01-20",
      ).map((occurrence) => occurrence.occurrenceDate),
    ).toEqual(["2026-01-10", "2026-01-13", "2026-01-16", "2026-01-19"]);
  });

  it("generates a custom cadence every 3 months, clamping to the anchor day", () => {
    expect(
      generateScheduleOccurrences(
        { start_date: "2026-01-31", frequency: "custom", interval_count: 3, interval_unit: "month", until_date: null },
        "2026-01-01",
        "2027-02-28",
      ).map((occurrence) => occurrence.occurrenceDate),
    ).toEqual(["2026-01-31", "2026-04-30", "2026-07-31", "2026-10-31", "2027-01-31"]);
  });

  it("generates a custom cadence every 2 months across a year boundary", () => {
    expect(
      generateScheduleOccurrences(
        { start_date: "2026-11-15", frequency: "custom", interval_count: 2, interval_unit: "month", until_date: null },
        "2026-11-01",
        "2027-05-31",
      ).map((occurrence) => occurrence.occurrenceDate),
    ).toEqual(["2026-11-15", "2027-01-15", "2027-03-15", "2027-05-15"]);
  });

  it("ignores stored interval fields for presets", () => {
    expect(resolveScheduleInterval({ frequency: "quarterly", interval_count: 7, interval_unit: "day" })).toEqual({
      count: 3,
      unit: "month",
    });
    expect(resolveScheduleInterval({ frequency: "yearly" })).toEqual({ count: 12, unit: "month" });
    expect(resolveScheduleInterval({ frequency: "custom", interval_count: 9, interval_unit: "day" })).toEqual({
      count: 9,
      unit: "day",
    });
  });

  it("recognises presets from a cadence", () => {
    expect(findScheduleFrequency({ count: 1, unit: "week" })).toBe("weekly");
    expect(findScheduleFrequency({ count: 3, unit: "month" })).toBe("quarterly");
    expect(findScheduleFrequency({ count: 9, unit: "day" })).toBe("custom");
  });
});
