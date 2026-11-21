import { describe, expect, it } from "vitest";

import { mapSpendingForecastRows, type SpendingForecastRow } from "@/features/budget/lib/spending-forecast-view";

function row(overrides: Partial<SpendingForecastRow>): SpendingForecastRow {
  return {
    category_id: "c1",
    currency: "CZK",
    budget: 9000,
    spent_to_date: 6887.1,
    planned_remaining: 0,
    forecast_p10: 6910.66,
    forecast_p50: 7496,
    forecast_p90: 16473.67,
    baseline_runrate: 10330.65,
    status: "ok",
    expected_overrun_date: null,
    method: "chronos",
    model: "amazon/chronos-bolt-small",
    month: "2026-11-01",
    forecast_date: "2026-11-20",
    finance_categories: { name: "Living Costs", icon: "wallet" },
    ...overrides,
  };
}

describe("mapSpendingForecastRows", () => {
  it("returns an empty forecast when nothing is stored", () => {
    expect(mapSpendingForecastRows([])).toEqual({ month: null, forecast_date: null, forecasts: [] });
  });

  it("converts PostgREST numeric strings and flattens the category join", () => {
    const result = mapSpendingForecastRows([row({ budget: "49900.00", forecast_p50: "58109.96", finance_categories: [{ name: "Enjoy Life", icon: "party-popper" }] })]);
    expect(result.forecasts[0]).toMatchObject({ budget: 49900, forecast_p50: 58109.96, category_name: "Enjoy Life", category_icon: "party-popper" });
    expect(result.month).toBe("2026-11-01");
    expect(result.forecast_date).toBe("2026-11-20");
  });

  it("orders envelopes by how full the median leaves them", () => {
    const result = mapSpendingForecastRows([
      row({ category_id: "living" }),
      row({ category_id: "enjoy", budget: 49900, forecast_p50: 58109.96 }),
      row({ category_id: "bills", budget: 41500, forecast_p50: 41069.45 }),
    ]);
    expect(result.forecasts.map((forecast) => forecast.category_id)).toEqual(["enjoy", "bills", "living"]);
  });
});
