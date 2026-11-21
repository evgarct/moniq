import type { SpendingForecastMethod, SpendingForecastStatus } from "@/features/budget/lib/spending-forecast";

/** One envelope of the latest stored forecast, in the shape the MCP tool also returns. */
export type SpendingForecastView = {
  category_id: string;
  category_name: string;
  category_icon: string | null;
  currency: string;
  budget: number;
  spent_to_date: number;
  planned_remaining: number;
  forecast_p10: number;
  forecast_p50: number;
  forecast_p90: number;
  baseline_runrate: number;
  status: SpendingForecastStatus;
  expected_overrun_date: string | null;
  method: SpendingForecastMethod;
  model: string | null;
};

export type SpendingForecastResponse = {
  month: string | null;
  forecast_date: string | null;
  forecasts: SpendingForecastView[];
};

type CategoryJoin = { name: string; icon: string | null };

/** A `spending_forecasts` row as PostgREST returns it: numerics may arrive as strings. */
export type SpendingForecastRow = {
  category_id: string;
  currency: string;
  budget: number | string;
  spent_to_date: number | string;
  planned_remaining: number | string;
  forecast_p10: number | string;
  forecast_p50: number | string;
  forecast_p90: number | string;
  baseline_runrate: number | string;
  status: SpendingForecastStatus;
  expected_overrun_date: string | null;
  method: SpendingForecastMethod;
  model: string | null;
  month: string;
  forecast_date: string;
  finance_categories: CategoryJoin | CategoryJoin[] | null;
};

const toNumber = (value: number | string) => (typeof value === "number" ? value : Number(value));

/** Maps stored rows to the response, fullest envelope first (median spend over budget). */
export function mapSpendingForecastRows(rows: SpendingForecastRow[]): SpendingForecastResponse {
  if (rows.length === 0) return { month: null, forecast_date: null, forecasts: [] };
  const forecasts = rows
    .map((row): SpendingForecastView => {
      const category = Array.isArray(row.finance_categories) ? row.finance_categories[0] : row.finance_categories;
      return {
        category_id: row.category_id,
        category_name: category?.name ?? "",
        category_icon: category?.icon ?? null,
        currency: row.currency,
        budget: toNumber(row.budget),
        spent_to_date: toNumber(row.spent_to_date),
        planned_remaining: toNumber(row.planned_remaining),
        forecast_p10: toNumber(row.forecast_p10),
        forecast_p50: toNumber(row.forecast_p50),
        forecast_p90: toNumber(row.forecast_p90),
        baseline_runrate: toNumber(row.baseline_runrate),
        status: row.status,
        expected_overrun_date: row.expected_overrun_date,
        method: row.method,
        model: row.model,
      };
    })
    .sort((a, b) => b.forecast_p50 / (b.budget || 1) - a.forecast_p50 / (a.budget || 1));
  return { month: rows[0].month, forecast_date: rows[0].forecast_date, forecasts };
}
