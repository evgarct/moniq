import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  mapSpendingForecastRows,
  type SpendingForecastResponse,
  type SpendingForecastRow,
} from "@/features/budget/lib/spending-forecast-view";

/**
 * The caller's latest forecast run. RLS limits rows to the signed-in user (cookie or the Android
 * bearer session); nothing here calls the model, the daily cron writes the rows.
 */
export async function getLatestSpendingForecast(): Promise<SpendingForecastResponse> {
  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  if (claimsError || !claims?.claims?.sub) throw new Error("Unauthorized");

  const latest = await supabase
    .from("spending_forecasts")
    .select("forecast_date")
    .order("forecast_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latest.error) throw new Error(latest.error.message);
  if (!latest.data) return { month: null, forecast_date: null, forecasts: [] };

  const { data, error } = await supabase
    .from("spending_forecasts")
    .select(
      "category_id, currency, budget, spent_to_date, planned_remaining, forecast_p10, forecast_p50, forecast_p90, baseline_runrate, status, expected_overrun_date, method, model, month, forecast_date, finance_categories(name, icon)",
    )
    .eq("forecast_date", latest.data.forecast_date);
  if (error) throw new Error(error.message);
  return mapSpendingForecastRows((data ?? []) as unknown as SpendingForecastRow[]);
}
