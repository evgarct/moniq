import { addMonths, format } from "date-fns";
import { describe, expect, it } from "vitest";

import {
  buildProjectedBalanceSearchParams,
  parseProjectedBalanceUrlState,
} from "./projected-balance-url";

const accounts = [{ id: "wallet-1" }, { id: "wallet-2" }];
const now = new Date("2026-06-14T12:00:00Z");

describe("projected balance URL state", () => {
  it("round-trips valid series and end date", () => {
    const params = buildProjectedBalanceSearchParams({
      endDate: "2026-12-14",
      series: [
        { id: "one", name: "Primary", accountIds: ["wallet-1"] },
        { id: "two", name: "Combined", accountIds: ["wallet-1", "wallet-2"] },
      ],
    });

    expect(
      parseProjectedBalanceUrlState({
        searchParams: params,
        accounts,
        defaultSeriesName: "All accounts",
        now,
      }),
    ).toEqual({
      endDate: "2026-12-14",
      series: [
        { id: "one", name: "Primary", accountIds: ["wallet-1"] },
        { id: "two", name: "Combined", accountIds: ["wallet-1", "wallet-2"] },
      ],
    });
  });

  it("removes unknown accounts and falls back when the URL is invalid", () => {
    const params = buildProjectedBalanceSearchParams({
      endDate: "2999-01-01",
      series: [{ id: "missing", name: "Missing", accountIds: ["deleted"] }],
    });
    params.append("series", "not-base64");

    const state = parseProjectedBalanceUrlState({
      searchParams: params,
      accounts,
      defaultSeriesName: "All accounts",
      now,
    });

    expect(state.series).toEqual([{
      id: "all-accounts",
      name: "All accounts",
      accountIds: ["wallet-1", "wallet-2"],
    }]);
    expect(state.endDate).toBe(format(addMonths(now, 18), "yyyy-MM-dd"));
  });
});
