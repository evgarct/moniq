import { describe, expect, it, vi } from "vitest";

import {
  runSpendingForecast,
  type SpendingForecastDb,
} from "@/features/budget/lib/spending-forecast-run";
import { addDaysIso, type SpendingForecastSource } from "@/features/budget/lib/spending-forecast";

const TODAY = "2026-10-20";
const CAFE = "11111111-1111-1111-1111-111111111111";
const WALLET = "aaaaaaaa-0000-0000-0000-000000000001";

function sourceWithHistory(days: number): SpendingForecastSource {
  return {
    default_currency: "CZK",
    wallets: [{ id: WALLET, currency: "CZK" }],
    categories: [
      { id: CAFE, name: "Cafe", description: "[budget: 3000]", icon: "☕", type: "expense", parent_id: null, purpose: null, is_contribution: false },
    ],
    history: Array.from({ length: days }, (_, index) => ({
      occurred_at: addDaysIso(TODAY, -index),
      amount: 100,
      category_id: CAFE,
      source_account_id: WALLET,
      schedule_id: null,
    })),
    planned: [],
    exchange_rates: [],
  };
}

function makeDb(source: SpendingForecastSource) {
  const saved: unknown[][] = [];
  const db: SpendingForecastDb = {
    listBudgetedUserIds: async () => ["user-1"],
    loadSource: async () => source,
    saveForecasts: async (rows) => {
      saved.push(rows);
    },
  };
  return { db, saved };
}

const horizon = 11;
const flat = (value: number) => Array.from({ length: horizon }, () => value);

describe("runSpendingForecast", () => {
  it("sends one batch to the model and stores one row per budgeted category", async () => {
    const { db, saved } = makeDb(sourceWithHistory(60));
    const requestForecast = vi.fn(async (args: { horizon: number; series: { id: string }[] }) => ({
      model: "amazon/chronos-bolt-small",
      forecasts: new Map(args.series.map((series) => [series.id, { p10: flat(80), p50: flat(100), p90: flat(130) }])),
    }));

    const [result] = await runSpendingForecast({ today: TODAY, dryRun: false, db, requestForecast });

    expect(requestForecast).toHaveBeenCalledTimes(1);
    expect(requestForecast.mock.calls[0][0]).toMatchObject({ horizon, series: [{ id: CAFE }] });
    expect(result.status).toBe("ok");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      user_id: "user-1",
      forecast_date: TODAY,
      month: "2026-10-01",
      method: "chronos",
      model: "amazon/chronos-bolt-small",
      spent_to_date: 2000,
      // 2000 spent + 11 days x 100 median = 3100 > 3000 budget.
      forecast_p50: 3100,
      status: "over",
    });
    expect(saved).toHaveLength(1);
  });

  it("does not store anything in dry-run mode", async () => {
    const { db, saved } = makeDb(sourceWithHistory(60));
    const requestForecast = vi.fn(async () => ({
      model: "m",
      forecasts: new Map([[CAFE, { p10: flat(1), p50: flat(1), p90: flat(1) }]]),
    }));
    const [result] = await runSpendingForecast({ today: TODAY, dryRun: true, db, requestForecast });
    expect(result.rows).toHaveLength(1);
    expect(saved).toEqual([]);
  });

  it("uses the baseline without calling the model when history is short", async () => {
    const { db, saved } = makeDb(sourceWithHistory(10));
    const requestForecast = vi.fn();
    const [result] = await runSpendingForecast({ today: TODAY, dryRun: false, db, requestForecast });
    expect(requestForecast).not.toHaveBeenCalled();
    expect(result.rows[0]).toMatchObject({ method: "baseline", model: null });
    expect(saved).toHaveLength(1);
  });

  it("stores nothing for a user when the model is down, and reports the failure", async () => {
    const { db, saved } = makeDb(sourceWithHistory(60));
    const log = vi.fn();
    const requestForecast = vi.fn(async () => {
      throw new Error("Forecast service answered 503.");
    });
    const [result] = await runSpendingForecast({ today: TODAY, dryRun: false, db, requestForecast, log });
    expect(result).toMatchObject({ status: "failed", rows: [], error: "Forecast service answered 503." });
    expect(saved).toEqual([]);
    expect(log).toHaveBeenCalledWith("spending_forecast_user_failed", expect.objectContaining({ userId: "user-1" }));
  });

  it("does nothing on the last day of the month", async () => {
    const { db, saved } = makeDb(sourceWithHistory(60));
    const requestForecast = vi.fn();
    const [result] = await runSpendingForecast({ today: "2026-10-31", dryRun: false, db, requestForecast });
    expect(result.status).toBe("last_day");
    expect(requestForecast).not.toHaveBeenCalled();
    expect(saved).toEqual([]);
  });

  it("defers users that would start after the time budget instead of risking a cut-off write", async () => {
    const source = sourceWithHistory(10);
    const loaded: string[] = [];
    const db: SpendingForecastDb = {
      listBudgetedUserIds: async () => ["first", "second"],
      loadSource: async ({ userId }) => {
        loaded.push(userId);
        return source;
      },
      saveForecasts: async () => {},
    };
    let clock = 0;
    const log = vi.fn();
    const results = await runSpendingForecast({
      today: TODAY,
      dryRun: false,
      db,
      requestForecast: vi.fn(),
      log,
      startNewUserBefore: 1_500,
      // The clock advances 800 ms per check, so the second user is past the 1 500 ms budget.
      now: () => (clock += 800),
    });
    expect(results.map((item) => item.status)).toEqual(["ok", "deferred"]);
    expect(loaded).toEqual(["first"]);
    expect(log).toHaveBeenCalledWith("spending_forecast_user_deferred", expect.objectContaining({ userId: "second" }));
  });

  it("keeps going with the next user after one fails", async () => {
    const good = sourceWithHistory(10);
    const db: SpendingForecastDb = {
      listBudgetedUserIds: async () => ["bad", "good"],
      loadSource: async ({ userId }) => {
        if (userId === "bad") throw new Error("boom");
        return good;
      },
      saveForecasts: async () => {},
    };
    const results = await runSpendingForecast({ today: TODAY, dryRun: false, db, requestForecast: vi.fn() });
    expect(results.map((item) => item.status)).toEqual(["failed", "ok"]);
  });
});
