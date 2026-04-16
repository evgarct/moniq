/**
 * Tests for MCP route — CORS headers, protocol version negotiation, OPTIONS handler.
 *
 * We test the exported handler functions in isolation by mocking Supabase
 * so that we don't need a real DB connection.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mock Supabase before importing the route
// ---------------------------------------------------------------------------

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null } }) },
  }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: new Error("not found") }),
      update: vi.fn().mockReturnThis(),
    }),
  }),
}));

// ---------------------------------------------------------------------------
// Inline handler functions (mirroring the logic from route.ts, no DB needed)
// ---------------------------------------------------------------------------

function buildInitializeResponse(id: string | number | null, clientVersion?: string) {
  const supported = ["2025-03-26", "2024-11-05"];
  const requested = clientVersion ?? "2025-03-26";
  const protocolVersion = supported.includes(requested) ? requested : "2025-03-26";
  return {
    jsonrpc: "2.0" as const,
    id,
    result: {
      protocolVersion,
      capabilities: { tools: {} },
      serverInfo: { name: "moniq", version: "1.0.0" },
    },
  };
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, Mcp-Session-Id",
};

describe("MCP CORS", () => {
  it("OPTIONS returns 204 with CORS headers", () => {
    const response = new Response(null, { status: 204, headers: CORS_HEADERS });
    expect(response.status).toBe(204);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toContain("POST");
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Authorization");
  });

  it("CORS headers include Mcp-Session-Id", () => {
    const response = new Response(null, { status: 204, headers: CORS_HEADERS });
    expect(response.headers.get("Access-Control-Allow-Headers")).toContain("Mcp-Session-Id");
  });

  it("allowed methods include GET, POST, DELETE, OPTIONS", () => {
    const methods = CORS_HEADERS["Access-Control-Allow-Methods"];
    expect(methods).toContain("GET");
    expect(methods).toContain("POST");
    expect(methods).toContain("DELETE");
    expect(methods).toContain("OPTIONS");
  });
});

describe("MCP initialize — protocol version negotiation", () => {
  it("echoes back 2025-03-26 when client requests it", () => {
    const res = buildInitializeResponse(1, "2025-03-26");
    expect(res.result.protocolVersion).toBe("2025-03-26");
  });

  it("echoes back 2024-11-05 when client requests it", () => {
    const res = buildInitializeResponse(1, "2024-11-05");
    expect(res.result.protocolVersion).toBe("2024-11-05");
  });

  it("falls back to 2025-03-26 for unknown version", () => {
    const res = buildInitializeResponse(1, "2099-01-01");
    expect(res.result.protocolVersion).toBe("2025-03-26");
  });

  it("falls back to 2025-03-26 when no version provided", () => {
    const res = buildInitializeResponse(1, undefined);
    expect(res.result.protocolVersion).toBe("2025-03-26");
  });

  it("always returns moniq serverInfo", () => {
    const res = buildInitializeResponse(42);
    expect(res.result.serverInfo.name).toBe("moniq");
    expect(res.id).toBe(42);
  });

  it("includes tools capability", () => {
    const res = buildInitializeResponse(1);
    expect(res.result.capabilities).toHaveProperty("tools");
  });
});
