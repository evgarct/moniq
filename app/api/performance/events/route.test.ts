import { describe, expect, it, vi } from "vitest";

const recordPerformanceEvent = vi.fn(async () => undefined);

vi.mock("@/lib/performance/server", () => ({
  getPerformanceSessionId: vi.fn(async () => "session-id"),
  recordPerformanceEvent,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({
    auth: {
      getUser: vi.fn(async () => ({ data: { user: { id: "user-id" } } })),
    },
  })),
}));

describe("POST /api/performance/events", () => {
  it("rejects invalid batches", async () => {
    const { POST } = await import("@/app/api/performance/events/route");
    const response = await POST(new Request("https://moniq.local/api/performance/events", {
      method: "POST",
      body: JSON.stringify({ events: [] }),
    }));

    expect(response.status).toBe(400);
  });

  it("accepts valid batches", async () => {
    recordPerformanceEvent.mockClear();
    const { POST } = await import("@/app/api/performance/events/route");
    const response = await POST(new Request("https://moniq.local/api/performance/events", {
      method: "POST",
      body: JSON.stringify({
        events: [
          {
            event_type: "web_vital",
            name: "LCP",
            duration_ms: 1200,
          },
        ],
      }),
    }));

    expect(response.status).toBe(204);
    expect(recordPerformanceEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "web_vital",
        name: "LCP",
        userId: "user-id",
        sessionId: "session-id",
      }),
    );
  });
});
