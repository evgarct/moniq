import { addMonths, format } from "date-fns";
import { describe, expect, it } from "vitest";

import {
  buildProjectedBalanceSearchParams,
  parseProjectedBalanceUrlState,
} from "./projected-balance-url";

const accounts = [{ id: "wallet-1" }, { id: "wallet-2" }];
const now = new Date("2026-06-14T12:00:00Z");

describe("projected balance URL state", () => {
  it("round-trips selected accounts, merged mode, and end date", () => {
    const params = buildProjectedBalanceSearchParams({
      endDate: "2026-12-14",
      selection: {
        accountIds: ["wallet-1", "wallet-2"],
        merged: false,
      },
    });

    expect(
      parseProjectedBalanceUrlState({
        searchParams: params,
        accounts,
        now,
      }),
    ).toEqual({
      endDate: "2026-12-14",
      selection: {
        accountIds: ["wallet-1", "wallet-2"],
        merged: false,
      },
    });
  });

  it("removes unknown accounts and falls back when the URL is invalid", () => {
    const params = buildProjectedBalanceSearchParams({
      endDate: "2999-01-01",
      selection: {
        accountIds: ["deleted"],
        merged: false,
      },
    });

    expect(
      parseProjectedBalanceUrlState({
        searchParams: params,
        accounts,
        now,
      }),
    ).toEqual({
      endDate: format(addMonths(now, 18), "yyyy-MM-dd"),
      selection: {
        accountIds: ["wallet-1", "wallet-2"],
        merged: true,
      },
    });
  });

  it("migrates account ids from the previous series URL format", () => {
    const legacySeries = btoa(JSON.stringify({
      id: "all",
      name: "All accounts",
      accountIds: ["wallet-1", "wallet-2"],
    })).replace(/=+$/g, "");
    const params = new URLSearchParams({
      end: "2026-12-14",
      series: legacySeries,
    });

    expect(
      parseProjectedBalanceUrlState({
        searchParams: params,
        accounts,
        now,
      }).selection,
    ).toEqual({
      accountIds: ["wallet-1", "wallet-2"],
      merged: true,
    });
  });

  it("uses remembered account selection only when URL selection is absent", () => {
    expect(
      parseProjectedBalanceUrlState({
        searchParams: new URLSearchParams(),
        accounts,
        rememberedSelection: {
          accountIds: ["wallet-2", "deleted"],
          merged: false,
        },
        now,
      }).selection,
    ).toEqual({
      accountIds: ["wallet-2"],
      merged: false,
    });

    expect(
      parseProjectedBalanceUrlState({
        searchParams: new URLSearchParams({ account: "wallet-1" }),
        accounts,
        rememberedSelection: {
          accountIds: ["wallet-2"],
          merged: false,
        },
        now,
      }).selection,
    ).toEqual({
      accountIds: ["wallet-1"],
      merged: true,
    });
  });

  it("uses remembered period only when the URL period is absent", () => {
    expect(
      parseProjectedBalanceUrlState({
        searchParams: new URLSearchParams(),
        accounts,
        rememberedPeriodMonths: 12,
        now,
      }).endDate,
    ).toBe("2027-06-14");

    expect(
      parseProjectedBalanceUrlState({
        searchParams: new URLSearchParams({ end: "2026-08-14" }),
        accounts,
        rememberedPeriodMonths: 12,
        now,
      }).endDate,
    ).toBe("2026-08-14");
  });
});
