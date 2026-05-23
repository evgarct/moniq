import { describe, expect, it } from "vitest";

import { clientPerformanceEventBatchSchema } from "@/lib/performance/schema";

describe("clientPerformanceEventBatchSchema", () => {
  it("accepts valid client performance batches", () => {
    expect(
      clientPerformanceEventBatchSchema.safeParse({
        events: [
          {
            event_type: "fetch",
            name: "/api/finance/snapshot",
            route: "/api/finance/snapshot",
            method: "GET",
            status: 200,
            duration_ms: 123.4,
            metadata: {
              response_bytes: 2048,
              error: null,
            },
          },
        ],
      }).success,
    ).toBe(true);
  });

  it("rejects server-only event types from client payloads", () => {
    expect(
      clientPerformanceEventBatchSchema.safeParse({
        events: [{ event_type: "db_phase", name: "finance_snapshot" }],
      }).success,
    ).toBe(false);
  });

  it("rejects oversized metadata", () => {
    const metadata = Object.fromEntries(Array.from({ length: 25 }, (_, index) => [`key_${index}`, index]));

    expect(
      clientPerformanceEventBatchSchema.safeParse({
        events: [{ event_type: "web_vital", name: "LCP", metadata }],
      }).success,
    ).toBe(false);
  });
});
