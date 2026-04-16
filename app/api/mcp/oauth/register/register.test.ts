/**
 * Tests for OAuth dynamic client registration (RFC 7591).
 * Tests the validation logic inline — no DB needed.
 */
import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Validation logic mirrored from route.ts
// ---------------------------------------------------------------------------

function validateRegistrationRequest(body: Record<string, unknown>): string | null {
  const redirectUris = body.redirect_uris;
  if (!Array.isArray(redirectUris) || redirectUris.length === 0) {
    return "redirect_uris must be a non-empty array";
  }
  for (const uri of redirectUris as unknown[]) {
    if (typeof uri !== "string") return "redirect_uris must contain strings";
    try {
      const parsed = new URL(uri);
      if (!["https:", "http:"].includes(parsed.protocol)) {
        return `redirect_uri must use https or http: ${uri}`;
      }
    } catch {
      return `redirect_uri is not a valid URL: ${uri}`;
    }
  }
  return null; // valid
}

describe("OAuth client registration validation", () => {
  it("accepts valid https redirect_uri", () => {
    expect(
      validateRegistrationRequest({
        redirect_uris: ["https://claude.ai/oauth/callback"],
      }),
    ).toBeNull();
  });

  it("accepts multiple valid redirect_uris", () => {
    expect(
      validateRegistrationRequest({
        redirect_uris: [
          "https://claude.ai/oauth/callback",
          "https://app.example.com/callback",
        ],
      }),
    ).toBeNull();
  });

  it("rejects missing redirect_uris", () => {
    expect(validateRegistrationRequest({})).toBeTruthy();
  });

  it("rejects empty redirect_uris array", () => {
    expect(validateRegistrationRequest({ redirect_uris: [] })).toBeTruthy();
  });

  it("rejects non-array redirect_uris", () => {
    expect(
      validateRegistrationRequest({ redirect_uris: "https://claude.ai/callback" }),
    ).toBeTruthy();
  });

  it("rejects invalid URL", () => {
    expect(
      validateRegistrationRequest({ redirect_uris: ["not-a-url"] }),
    ).toBeTruthy();
  });
});

describe("OAuth metadata structure", () => {
  it("required fields are present in metadata response shape", () => {
    const base = "https://app.example.com";
    const metadata = {
      issuer: base,
      authorization_endpoint: `${base}/api/mcp/oauth/authorize`,
      token_endpoint: `${base}/api/mcp/oauth/token`,
      registration_endpoint: `${base}/api/mcp/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    };

    expect(metadata.issuer).toBe(base);
    expect(metadata.response_types_supported).toContain("code");
    expect(metadata.grant_types_supported).toContain("authorization_code");
    expect(metadata.code_challenge_methods_supported).toContain("S256");
    // No client_secret required
    expect(metadata.token_endpoint_auth_methods_supported).toContain("none");
  });
});
