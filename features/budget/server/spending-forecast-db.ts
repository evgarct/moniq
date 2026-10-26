import "server-only";

import type { SpendingForecastDb } from "@/features/budget/lib/spending-forecast-run";
import type { SpendingForecastSource } from "@/features/budget/lib/spending-forecast";
import { createServiceClient } from "@/lib/supabase/service";

/** Service-role access for the daily forecast cron: every query is scoped to an explicit user id. */
export function createSpendingForecastDb(): SpendingForecastDb {
  const service = createServiceClient();

  return {
    async listBudgetedUserIds() {
      const { data, error } = await service
        .from("finance_categories")
        .select("user_id")
        .eq("type", "expense")
        .is("parent_id", null)
        .like("description", "[budget:%");
      if (error) throw new Error(`Unable to list budgeted users: ${error.message}`);
      return Array.from(new Set((data ?? []).map((row) => row.user_id as string)));
    },

    async loadSource({ userId, today, monthEnd, historyStart }) {
      const { data, error } = await service.rpc("spending_forecast_source", {
        p_user_id: userId,
        p_today: today,
        p_month_end: monthEnd,
        p_history_start: historyStart,
      });
      if (error) throw new Error(`Unable to load forecast source: ${error.message}`);
      return data as SpendingForecastSource;
    },

    async saveForecasts(rows) {
      const { error } = await service
        .from("spending_forecasts")
        .upsert(rows, { onConflict: "user_id,forecast_date,category_id" });
      if (error) throw new Error(`Unable to save forecasts: ${error.message}`);
    },
  };
}
