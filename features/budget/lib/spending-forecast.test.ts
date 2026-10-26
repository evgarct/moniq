import { describe, expect, it } from "vitest";

import {
  addDaysIso,
  buildForecastContext,
  buildForecastInputs,
  classifyForecast,
  computeCategoryForecast,
  isModelEligible,
  type CategoryForecastInput,
  type SpendingForecastSource,
} from "@/features/budget/lib/spending-forecast";

const TODAY = "2026-10-20";
const CAFE = "11111111-1111-1111-1111-111111111111";
const CAFE_CHILD = "11111111-1111-1111-1111-222222222222";
const SAVINGS = "33333333-3333-3333-3333-333333333333";
const CZK_WALLET = "aaaaaaaa-0000-0000-0000-000000000001";
const EUR_WALLET = "aaaaaaaa-0000-0000-0000-000000000002";

function category(overrides: Partial<SpendingForecastSource["categories"][number]> & { id: string }) {
  return {
    name: overrides.id,
    description: null,
    icon: null,
    type: "expense" as const,
    parent_id: null,
    purpose: null,
    is_contribution: false,
    ...overrides,
  };
}

function source(overrides: Partial<SpendingForecastSource> = {}): SpendingForecastSource {
  return {
    default_currency: "CZK",
    wallets: [
      { id: CZK_WALLET, currency: "CZK" },
      { id: EUR_WALLET, currency: "EUR" },
    ],
    categories: [
      category({ id: CAFE, name: "Cafe", icon: "☕", description: "[budget: 3000] coffee" }),
      category({ id: CAFE_CHILD, parent_id: CAFE }),
      category({ id: SAVINGS, description: "[budget: 5000]", is_contribution: true }),
    ],
    history: [],
    planned: [],
    exchange_rates: [],
    ...overrides,
  };
}

function dailyHistory(days: number, amount: number, categoryId = CAFE, accountId = CZK_WALLET) {
  return Array.from({ length: days }, (_, index) => ({
    occurred_at: addDaysIso(TODAY, -index),
    amount,
    category_id: categoryId,
    source_account_id: accountId,
    schedule_id: null,
  }));
}

function input(overrides: Partial<CategoryForecastInput> = {}): CategoryForecastInput {
  return {
    categoryId: CAFE,
    name: "Cafe",
    icon: null,
    budget: 3000,
    spentToDate: 0,
    plannedRemaining: 0,
    plannedByDate: {},
    series: { start: "2026-05-01", values: [] },
    historyDays: 100,
    activeDays: 50,
    ...overrides,
  };
}

const context = buildForecastContext(TODAY);

function flat(value: number, days = context.horizon) {
  return Array.from({ length: days }, () => value);
}

describe("buildForecastContext", () => {
  it("counts the days left after today", () => {
    expect(context).toMatchObject({ month: "2026-10-01", monthEnd: "2026-10-31", daysElapsed: 20, daysInMonth: 31, horizon: 11 });
  });

  it("has a zero horizon on the last day of the month", () => {
    expect(buildForecastContext("2026-10-31").horizon).toBe(0);
    expect(buildForecastContext("2028-02-29").horizon).toBe(0);
  });
});

describe("classifyForecast", () => {
  const base = { budget: 1000, method: "chronos" as const };

  it("is over_likely when even the low quantile exceeds the budget", () => {
    expect(classifyForecast({ ...base, p10: 1000.01, p50: 1200 })).toBe("over_likely");
  });

  it("is over when the median exceeds the budget but the low quantile does not", () => {
    expect(classifyForecast({ ...base, p10: 900, p50: 1000.01 })).toBe("over");
  });

  it("treats exactly the budget as tight, not over", () => {
    expect(classifyForecast({ ...base, p10: 800, p50: 1000 })).toBe("tight");
  });

  it("treats exactly 90% of the budget as tight", () => {
    expect(classifyForecast({ ...base, p10: 800, p50: 900 })).toBe("tight");
    expect(classifyForecast({ ...base, p10: 800, p50: 899.99 })).toBe("ok");
  });

  it("ignores float noise below a cent", () => {
    expect(classifyForecast({ ...base, p10: 0, p50: 1000.004 })).toBe("tight");
    expect(classifyForecast({ budget: 0.3, method: "chronos", p10: 0, p50: 0.1 + 0.2 })).toBe("tight");
  });

  it("never reports over_likely for the baseline", () => {
    expect(classifyForecast({ ...base, method: "baseline", p10: 2000, p50: 2000 })).toBe("over");
  });
});

describe("computeCategoryForecast", () => {
  it("adds spent, planned and the summed daily quantiles", () => {
    const forecast = computeCategoryForecast(
      input({ spentToDate: 1000, plannedRemaining: 300 }),
      context,
      { p10: flat(10), p50: flat(50), p90: flat(100) },
    );
    expect(forecast.method).toBe("chronos");
    expect(forecast.forecastP10).toBe(1410);
    expect(forecast.forecastP50).toBe(1850);
    expect(forecast.forecastP90).toBe(2400);
    expect(forecast.status).toBe("ok");
    expect(forecast.expectedOverrunDate).toBeNull();
  });

  it("finds the first day the cumulative median passes the budget", () => {
    // 2500 spent + 100 per day: day 5 reaches 3000 exactly (not over), day 6 passes it.
    const forecast = computeCategoryForecast(
      input({ spentToDate: 2500 }),
      context,
      { p10: flat(100), p50: flat(100), p90: flat(100) },
    );
    expect(forecast.status).toBe("over_likely");
    expect(forecast.expectedOverrunDate).toBe("2026-10-26");
  });

  it("counts a planned payment on its date when locating the overrun", () => {
    const forecast = computeCategoryForecast(
      input({ spentToDate: 2000, plannedRemaining: 1100, plannedByDate: { "2026-10-22": 1100 } }),
      context,
      { p10: flat(20), p50: flat(20), p90: flat(20) },
    );
    expect(forecast.expectedOverrunDate).toBe("2026-10-22");
  });

  it("has no overrun date once the budget is already exceeded", () => {
    const forecast = computeCategoryForecast(
      input({ spentToDate: 3200 }),
      context,
      { p10: flat(10), p50: flat(10), p90: flat(10) },
    );
    expect(forecast.status).toBe("over_likely");
    expect(forecast.expectedOverrunDate).toBeNull();
  });

  it("rejects a model answer with the wrong number of days", () => {
    expect(() =>
      computeCategoryForecast(input(), context, { p10: flat(1, 3), p50: flat(1, 3), p90: flat(1, 3) }),
    ).toThrow(/expected 11/);
  });

  it("uses the run-rate baseline without quantiles and never goes below spent plus planned", () => {
    // 1000 over 20 days -> 1550 for the 31-day month.
    const paced = computeCategoryForecast(input({ spentToDate: 1000 }), context, null);
    expect(paced.method).toBe("baseline");
    expect(paced.baselineRunrate).toBe(1550);
    expect(paced.forecastP50).toBe(1550);
    expect(paced.forecastP10).toBe(paced.forecastP90);

    const withRent = computeCategoryForecast(input({ spentToDate: 1000, plannedRemaining: 2500 }), context, null);
    expect(withRent.baselineRunrate).toBe(1550);
    expect(withRent.forecastP50).toBe(3500);
    expect(withRent.status).toBe("over");
  });

  it("handles a category with no spending at all", () => {
    const forecast = computeCategoryForecast(input({ historyDays: 1, activeDays: 0 }), context, null);
    expect(forecast.forecastP50).toBe(0);
    expect(forecast.status).toBe("ok");
  });
});

describe("isModelEligible", () => {
  it("needs 30 days of history and 5 days with spending", () => {
    expect(isModelEligible({ historyDays: 30, activeDays: 5 })).toBe(true);
    expect(isModelEligible({ historyDays: 29, activeDays: 5 })).toBe(false);
    expect(isModelEligible({ historyDays: 30, activeDays: 4 })).toBe(false);
  });
});

describe("buildForecastInputs", () => {
  it("returns nothing without a default currency", () => {
    expect(buildForecastInputs(source({ default_currency: null }), TODAY)).toBeNull();
  });

  it("forecasts only budgeted top-level expense categories and skips contribution envelopes", () => {
    const result = buildForecastInputs(source({ history: dailyHistory(40, 100) }), TODAY)!;
    expect(result.inputs.map((item) => item.categoryId)).toEqual([CAFE]);
  });

  it("rolls subcategory spending into the parent and keeps recurring payments out of the series", () => {
    const history = [
      ...dailyHistory(40, 100, CAFE_CHILD),
      { occurred_at: "2026-10-05", amount: 700, category_id: CAFE, source_account_id: CZK_WALLET, schedule_id: "s1" },
    ];
    const [cafe] = buildForecastInputs(source({ history }), TODAY)!.inputs;
    // 20 days of 100 in October plus the 700 recurring payment still count as spent.
    expect(cafe.spentToDate).toBe(2700);
    expect(cafe.series.values).toHaveLength(40);
    expect(cafe.series.values.every((value) => value === 100)).toBe(true);
    expect(cafe.historyDays).toBe(40);
    expect(cafe.activeDays).toBe(40);
  });

  it("starts the series at the first recorded spend and fills quiet days with zero", () => {
    const history = [
      { occurred_at: "2026-10-18", amount: 40, category_id: CAFE, source_account_id: CZK_WALLET, schedule_id: null },
      { occurred_at: "2026-10-20", amount: 60, category_id: CAFE, source_account_id: CZK_WALLET, schedule_id: null },
    ];
    const [cafe] = buildForecastInputs(source({ history }), TODAY)!.inputs;
    expect(cafe.series).toEqual({ start: "2026-10-18", values: [40, 0, 60] });
    expect(isModelEligible(cafe)).toBe(false);
  });

  it("sums planned payments per day and in total", () => {
    const planned = [
      { occurred_at: "2026-10-22", amount: 300, category_id: CAFE_CHILD, source_account_id: CZK_WALLET },
      { occurred_at: "2026-10-22", amount: 50, category_id: CAFE, source_account_id: CZK_WALLET },
      { occurred_at: "2026-10-28", amount: 120, category_id: CAFE, source_account_id: CZK_WALLET },
    ];
    const [cafe] = buildForecastInputs(source({ planned }), TODAY)!.inputs;
    expect(cafe.plannedRemaining).toBe(470);
    expect(cafe.plannedByDate).toEqual({ "2026-10-22": 350, "2026-10-28": 120 });
  });

  it("converts other currencies into the default currency", () => {
    const history = [
      { occurred_at: "2026-10-10", amount: 10, category_id: CAFE, source_account_id: EUR_WALLET, schedule_id: null },
    ];
    const exchange_rates = [
      {
        provider: "frankfurter" as const,
        base_currency: "EUR" as const,
        quote_currency: "CZK" as const,
        requested_date: "2026-10-10",
        rate_date: "2026-10-10",
        rate: 25,
        fetched_at: "2026-10-10T12:00:00Z",
      },
    ];
    const [cafe] = buildForecastInputs(source({ history, exchange_rates }), TODAY)!.inputs;
    expect(cafe.spentToDate).toBe(250);
  });

  it("skips a category entirely when a rate is missing instead of publishing a partial total", () => {
    const history = [
      ...dailyHistory(5, 100),
      { occurred_at: "2026-10-10", amount: 10, category_id: CAFE, source_account_id: EUR_WALLET, schedule_id: null },
    ];
    const result = buildForecastInputs(source({ history }), TODAY)!;
    expect(result.inputs).toEqual([]);
    expect(result.skipped).toEqual([{ categoryId: CAFE, reason: "missing_rate" }]);
  });

  it("keeps a budgeted category with no history at all, as a zero baseline", () => {
    const [cafe] = buildForecastInputs(source(), TODAY)!.inputs;
    expect(cafe).toMatchObject({ spentToDate: 0, plannedRemaining: 0, historyDays: 1, activeDays: 0 });
    expect(isModelEligible(cafe)).toBe(false);
  });
});
