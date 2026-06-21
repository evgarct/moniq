import { describe, expect, it } from "vitest";

import {
  parseProjectedBalancePreferences,
  serializeProjectedBalancePreferences,
} from "./projected-balance-preferences";

describe("projected balance preferences", () => {
  it("round-trips the versioned preference shape", () => {
    expect(
      parseProjectedBalancePreferences(
        serializeProjectedBalancePreferences({
          accountIds: ["wallet-1"],
          merged: false,
          periodMonths: 12,
        }),
      ),
    ).toEqual({
      version: 1,
      accountIds: ["wallet-1"],
      merged: false,
      periodMonths: 12,
    });
  });

  it("migrates the legacy selection and defaults its period", () => {
    expect(
      parseProjectedBalancePreferences(
        null,
        JSON.stringify({ accountIds: ["wallet-2"], merged: true }),
      ),
    ).toEqual({
      version: 1,
      accountIds: ["wallet-2"],
      merged: true,
      periodMonths: 6,
    });
  });

  it("rejects malformed values", () => {
    expect(parseProjectedBalancePreferences("{bad")).toBeNull();
  });
});
