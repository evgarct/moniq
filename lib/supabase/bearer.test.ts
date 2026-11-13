import { describe, expect, it } from "vitest";

import { readMobileAccessToken } from "@/lib/supabase/bearer";

const JWT = "aaa.bbb.ccc";

function headers(values: Record<string, string>) {
  return new Headers(values);
}

describe("readMobileAccessToken", () => {
  it("returns the token for a marked native client", () => {
    expect(readMobileAccessToken(headers({ authorization: `Bearer ${JWT}`, "x-moniq-client": "android" }))).toBe(JWT);
    expect(readMobileAccessToken(headers({ authorization: `bearer ${JWT}`, "x-moniq-client": " Android " }))).toBe(JWT);
  });

  it("ignores bearer values without the client marker, so MCP keys keep their own path", () => {
    expect(readMobileAccessToken(headers({ authorization: `Bearer ${JWT}` }))).toBeNull();
    expect(readMobileAccessToken(headers({ authorization: `Bearer ${JWT}`, "x-moniq-client": "web" }))).toBeNull();
  });

  it("rejects values that are not a bearer JWT", () => {
    expect(readMobileAccessToken(headers({ "x-moniq-client": "android" }))).toBeNull();
    expect(readMobileAccessToken(headers({ authorization: JWT, "x-moniq-client": "android" }))).toBeNull();
    expect(readMobileAccessToken(headers({ authorization: "Basic abc", "x-moniq-client": "android" }))).toBeNull();
    expect(readMobileAccessToken(headers({ authorization: "Bearer mq_live_key", "x-moniq-client": "android" }))).toBeNull();
    expect(readMobileAccessToken(headers({ authorization: `Bearer ${JWT} extra`, "x-moniq-client": "android" }))).toBeNull();
  });
});
