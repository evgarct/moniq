import { describe, it, expect } from "vitest";
import { verifyPkce, buildChallenge, generateRawToken, sha256Hex } from "./pkce";

describe("PKCE S256", () => {
  it("verifies correct verifier against its challenge", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await buildChallenge(verifier);
    expect(await verifyPkce(verifier, challenge)).toBe(true);
  });

  it("rejects wrong verifier", async () => {
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const challenge = await buildChallenge(verifier);
    expect(await verifyPkce("wrong-verifier", challenge)).toBe(false);
  });

  it("handles RFC 7636 test vector", async () => {
    // From RFC 7636 Appendix B
    const verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
    const expectedChallenge = "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM";
    expect(await buildChallenge(verifier)).toBe(expectedChallenge);
    expect(await verifyPkce(verifier, expectedChallenge)).toBe(true);
  });

  it("uses base64url encoding (no +, /, = characters)", async () => {
    const verifier = "test-verifier-value-123";
    const challenge = await buildChallenge(verifier);
    expect(challenge).not.toContain("+");
    expect(challenge).not.toContain("/");
    expect(challenge).not.toContain("=");
  });
});

describe("generateRawToken", () => {
  it("returns a string starting with mnq_", () => {
    const token = generateRawToken();
    expect(token).toMatch(/^mnq_[0-9a-f]{64}$/);
  });

  it("generates unique tokens", () => {
    const tokens = new Set(Array.from({ length: 20 }, () => generateRawToken()));
    expect(tokens.size).toBe(20);
  });
});

describe("sha256Hex", () => {
  it("returns 64-character hex string", async () => {
    const hash = await sha256Hex("hello");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]+$/);
  });

  it("is deterministic", async () => {
    const hash1 = await sha256Hex("test-input");
    const hash2 = await sha256Hex("test-input");
    expect(hash1).toBe(hash2);
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await sha256Hex("input-a");
    const hash2 = await sha256Hex("input-b");
    expect(hash1).not.toBe(hash2);
  });
});
