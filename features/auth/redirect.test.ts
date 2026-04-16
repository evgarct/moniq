/**
 * Tests for auth redirect logic — specifically the fix for OAuth callback paths
 * that must not receive a locale prefix after login.
 */
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Inline the pure logic from actions.ts (no server-side imports needed)
// ---------------------------------------------------------------------------

function stripLocaleFromPathname(pathname: string): string {
  return pathname.replace(/^\/(en|ru)(?=\/|$)/, "") || "/";
}

function getRedirectPath(next: string): { path: string; isApi: boolean } {
  if (next.startsWith("/") && !next.startsWith("//")) {
    const url = new URL(next, "http://localhost");
    const pathname = stripLocaleFromPathname(url.pathname);
    const isApi = pathname.startsWith("/api/");
    return { path: `${pathname}${url.search}${url.hash}`, isApi };
  }
  return { path: "/today", isApi: false };
}

describe("getRedirectPath", () => {
  describe("regular app routes", () => {
    it("returns /today as default", () => {
      expect(getRedirectPath("")).toEqual({ path: "/today", isApi: false });
    });

    it("strips locale prefix from /en/ paths", () => {
      const result = getRedirectPath("/en/settings");
      expect(result.path).toBe("/settings");
      expect(result.isApi).toBe(false);
    });

    it("strips locale prefix from /ru/ paths", () => {
      const result = getRedirectPath("/ru/dashboard");
      expect(result.path).toBe("/dashboard");
      expect(result.isApi).toBe(false);
    });

    it("preserves paths without locale prefix", () => {
      const result = getRedirectPath("/settings");
      expect(result.path).toBe("/settings");
      expect(result.isApi).toBe(false);
    });

    it("preserves query string", () => {
      const result = getRedirectPath("/dashboard?tab=overview");
      expect(result.path).toBe("/dashboard?tab=overview");
    });

    it("rejects protocol-relative URLs (//evil.com)", () => {
      const result = getRedirectPath("//evil.com/steal");
      expect(result.path).toBe("/today");
    });
  });

  describe("OAuth API callback — isApi flag", () => {
    const oauthPath =
      "/api/mcp/oauth/authorize?client_id=abc&redirect_uri=https%3A%2F%2Fclaude.ai%2Fcallback&code_challenge=XYZ&response_type=code";

    it("marks /api/ paths as isApi=true", () => {
      const result = getRedirectPath(oauthPath);
      expect(result.isApi).toBe(true);
    });

    it("preserves the full query string for OAuth callback", () => {
      const result = getRedirectPath(oauthPath);
      expect(result.path).toContain("client_id=abc");
      expect(result.path).toContain("code_challenge=XYZ");
    });

    it("path starts with /api/ — no locale would be injected", () => {
      const result = getRedirectPath(oauthPath);
      expect(result.path.startsWith("/api/")).toBe(true);
    });

    it("marks /api/mcp/oauth/token as isApi", () => {
      expect(getRedirectPath("/api/mcp/oauth/token").isApi).toBe(true);
    });

    it("marks /api/mcp as isApi", () => {
      expect(getRedirectPath("/api/mcp").isApi).toBe(true);
    });

    it("does not mark /settings as isApi", () => {
      expect(getRedirectPath("/settings").isApi).toBe(false);
    });
  });
});
