import { describe, expect, it } from "vitest";
import { createScheduleReconciliationRetry } from "./schedule-reconciliation-retry";

describe("schedule reconciliation retry", () => {
  it("backs off failures and deduplicates notifications even on reconnect", () => {
    const retry = createScheduleReconciliationRetry();
    expect(retry.shouldAttempt("2026-10", 0)).toBe(true);
    expect(retry.failed(0)).toBe(true);
    expect(retry.shouldAttempt("2026-10", 60_000)).toBe(false);
    expect(retry.shouldAttempt("2026-11", 60_000, true)).toBe(false);
    expect(retry.shouldAttempt("2026-10", 300_000)).toBe(true);
    expect(retry.failed(300_000)).toBe(false);
    expect(retry.shouldAttempt("2026-10", 899_999)).toBe(false);
    expect(retry.shouldAttempt("2026-10", 900_000)).toBe(true);
  });

  it("reconciles each month and reconnect, resetting the outage after success", () => {
    const retry = createScheduleReconciliationRetry();
    retry.failed(0);
    retry.succeeded("2026-10");
    expect(retry.shouldAttempt("2026-10", 1)).toBe(false);
    expect(retry.shouldAttempt("2026-10", 1, true)).toBe(true);
    expect(retry.shouldAttempt("2026-11", 1)).toBe(true);
    expect(retry.failed(1)).toBe(true);
  });

  it("caps the retry delay at one hour", () => {
    const retry = createScheduleReconciliationRetry();
    for (let count = 0; count < 30; count += 1) retry.failed(0);
    expect(retry.shouldAttempt("2026-10", 3_599_999)).toBe(false);
    expect(retry.shouldAttempt("2026-10", 3_600_000)).toBe(true);
  });
});
