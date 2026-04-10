import { describe, expect, it } from "vitest";

import { buildImportFingerprint, matchImportRule, normalizeMerchant } from "@/features/banking/lib/import-rules";

describe("import-rules", () => {
  it("normalizes merchant labels into a cleaner title", () => {
    expect(normalizeMerchant("SPAR 1234 Praha CZ 9988")).toBe("Spar Praha Cz");
  });

  it("builds a stable fallback fingerprint for dedupe", () => {
    expect(
      buildImportFingerprint({
        accountId: "acc-1",
        amount: -42.5,
        currency: "EUR",
        date: "2026-04-10",
        merchant: "TESCO 001 PRAHA",
      }),
    ).toBe("acc-1:-42.50:2026-04-10:tesco praha");
  });

  it("matches a normalized merchant against category rules", () => {
    expect(
      matchImportRule(
        "Starbucks Reserve",
        [{ merchant_pattern: "starbucks", category_id: "coffee" }],
        [
          {
            id: "coffee",
            user_id: "user-1",
            name: "Coffee",
            icon: null,
            type: "expense",
            parent_id: null,
            created_at: "2026-04-10T10:00:00.000Z",
          },
        ],
      )?.name,
    ).toBe("Coffee");
  });
});
