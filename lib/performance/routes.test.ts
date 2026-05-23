import { describe, expect, it } from "vitest";

import { normalizePerformanceRoute } from "@/lib/performance/routes";

describe("normalizePerformanceRoute", () => {
  it("strips query strings and replaces private identifiers", () => {
    expect(
      normalizePerformanceRoute(
        "/api/transactions/550e8400-e29b-41d4-a716-446655440000?title=private",
      ),
    ).toBe("/api/transactions/[id]");
  });

  it("replaces long opaque tokens", () => {
    expect(normalizePerformanceRoute("/api/mcp/api-keys/key_1234567890abcdef123456")).toBe(
      "/api/mcp/api-keys/[id]",
    );
  });

  it("keeps stable route segments", () => {
    expect(normalizePerformanceRoute("https://moniq.local/en/dashboard")).toBe("/en/dashboard");
  });
});
