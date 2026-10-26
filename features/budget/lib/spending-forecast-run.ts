import {
  buildForecastContext,
  buildForecastInputs,
  computeCategoryForecast,
  addDaysIso,
  isModelEligible,
  type CategoryForecast,
  type SpendingForecastSource,
} from "@/features/budget/lib/spending-forecast";
import type { ForecastServiceResult, ForecastSeries } from "@/lib/forecast/client";
import type { CurrencyCode } from "@/types/currency";

/** The model learns from at most this many recent days of a category. */
export const HISTORY_WINDOW_DAYS = 180;

export type SpendingForecastRow = {
  user_id: string;
  forecast_date: string;
  month: string;
  category_id: string;
  currency: CurrencyCode;
  budget: number;
  spent_to_date: number;
  planned_remaining: number;
  forecast_p10: number;
  forecast_p50: number;
  forecast_p90: number;
  baseline_runrate: number;
  status: CategoryForecast["status"];
  expected_overrun_date: string | null;
  method: CategoryForecast["method"];
  model: string | null;
};

export type SpendingForecastDb = {
  listBudgetedUserIds(): Promise<string[]>;
  loadSource(args: { userId: string; today: string; monthEnd: string; historyStart: string }): Promise<SpendingForecastSource>;
  saveForecasts(rows: SpendingForecastRow[]): Promise<void>;
};

export type UserRunResult = {
  userId: string;
  /** `deferred`: the time budget ran out before this user was started; their previous rows stay untouched. */
  status: "ok" | "last_day" | "no_default_currency" | "failed" | "deferred";
  rows: SpendingForecastRow[];
  skippedCategories: string[];
  error?: string;
};

/**
 * Computes and stores today's forecast for every user with budgets. A failing user (model down, bad data) is
 * logged and left untouched: previous rows stay, and since the digest only shows a forecast dated today, it
 * simply omits the block. Nothing is invented when the model is unavailable.
 */
export async function runSpendingForecast(options: {
  today: string;
  dryRun: boolean;
  db: SpendingForecastDb;
  requestForecast: (args: { horizon: number; series: ForecastSeries[] }) => Promise<ForecastServiceResult>;
  log?: (event: string, details: Record<string, unknown>) => void;
  /**
   * Epoch ms after which no new user is started. Users are processed one at a time (the Supabase instance is
   * small), so the route sets this to its deadline minus one model timeout; later users are reported as deferred
   * instead of being cut off mid-write when the invocation ends.
   */
  startNewUserBefore?: number;
  now?: () => number;
}): Promise<UserRunResult[]> {
  const now = options.now ?? Date.now;
  const log = options.log ?? (() => {});
  const context = buildForecastContext(options.today);
  const userIds = await options.db.listBudgetedUserIds();
  const results: UserRunResult[] = [];

  for (const userId of userIds) {
    if (context.horizon === 0) {
      results.push({ userId, status: "last_day", rows: [], skippedCategories: [] });
      continue;
    }

    if (options.startNewUserBefore !== undefined && now() > options.startNewUserBefore) {
      log("spending_forecast_user_deferred", { userId, reason: "time_budget_exhausted" });
      results.push({ userId, status: "deferred", rows: [], skippedCategories: [] });
      continue;
    }

    try {
      const source = await options.db.loadSource({
        userId,
        today: options.today,
        monthEnd: context.monthEnd,
        historyStart: addDaysIso(options.today, -(HISTORY_WINDOW_DAYS - 1)),
      });
      const built = buildForecastInputs(source, options.today);
      if (!built) {
        results.push({ userId, status: "no_default_currency", rows: [], skippedCategories: [] });
        continue;
      }

      for (const skipped of built.skipped) {
        log("spending_forecast_category_skipped", { userId, categoryId: skipped.categoryId, reason: skipped.reason });
      }

      const eligible = built.inputs.filter(isModelEligible);
      const service = eligible.length
        ? await options.requestForecast({
            horizon: context.horizon,
            series: eligible.map((input) => ({ id: input.categoryId, ...input.series })),
          })
        : null;

      const rows = built.inputs.map((input): SpendingForecastRow => {
        const quantiles = isModelEligible(input) ? (service?.forecasts.get(input.categoryId) ?? null) : null;
        const forecast = computeCategoryForecast(input, context, quantiles);
        return {
          user_id: userId,
          forecast_date: options.today,
          month: context.month,
          category_id: forecast.categoryId,
          currency: built.currency,
          budget: forecast.budget,
          spent_to_date: forecast.spentToDate,
          planned_remaining: forecast.plannedRemaining,
          forecast_p10: forecast.forecastP10,
          forecast_p50: forecast.forecastP50,
          forecast_p90: forecast.forecastP90,
          baseline_runrate: forecast.baselineRunrate,
          status: forecast.status,
          expected_overrun_date: forecast.expectedOverrunDate,
          method: forecast.method,
          model: forecast.method === "chronos" ? (service?.model ?? null) : null,
        };
      });

      if (!options.dryRun && rows.length) {
        await options.db.saveForecasts(rows);
      }
      results.push({ userId, status: "ok", rows, skippedCategories: built.skipped.map((item) => item.categoryId) });
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown_error";
      log("spending_forecast_user_failed", { userId, reason: message });
      results.push({ userId, status: "failed", rows: [], skippedCategories: [], error: message });
    }
  }

  return results;
}
