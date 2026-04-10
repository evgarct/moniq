import { describe, expect, it } from "vitest";

import { normalizeMerchant } from "@/features/open-banking/lib/merchant-normalizer";

describe("normalizeMerchant", () => {
  it("normalizes uppercase merchant labels", () => {
    expect(normalizeMerchant("STARBUCKS 123 PRAHA")).toBe("Starbucks");
  });

  it("returns fallback when merchant text is empty after cleanup", () => {
    expect(normalizeMerchant("123 ---")).toBe("Unknown");
  });
});
