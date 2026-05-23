import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: () => ({ value: "test-session" }),
    set: vi.fn(),
  })),
}));
vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: () => ({
      insert: vi.fn(async () => {
        throw new Error("database unavailable");
      }),
    }),
  }),
}));

describe("recordPerformanceEvent", () => {
  beforeEach(() => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("does not throw when persistence fails", async () => {
    const { recordPerformanceEvent } = await import("@/lib/performance/server");

    await expect(
      recordPerformanceEvent({
        event_type: "api",
        name: "test",
        duration_ms: 10,
        sessionId: "session",
      }),
    ).resolves.toBeUndefined();
  });
});
