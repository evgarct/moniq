import type { DailyQuantiles } from "@/features/budget/lib/spending-forecast";

export const FORECAST_REQUEST_TIMEOUT_MS = 30_000;

export type ForecastSeries = { id: string; start: string; values: number[] };

export type ForecastServiceResult = {
  model: string;
  forecasts: Map<string, DailyQuantiles>;
};

function isNumberArray(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every((item) => typeof item === "number" && Number.isFinite(item));
}

/**
 * Calls the moniq-forecast service (Chronos on the Oracle VM). Any failure throws: callers must not invent
 * numbers when the model is unavailable.
 */
export async function requestForecast(options: {
  horizon: number;
  series: ForecastSeries[];
  baseUrl?: string;
  token?: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}): Promise<ForecastServiceResult> {
  const baseUrl = options.baseUrl ?? process.env.FORECAST_API_URL;
  const token = options.token ?? process.env.FORECAST_API_TOKEN;
  if (!baseUrl || !token) {
    throw new Error("Forecast service is not configured (FORECAST_API_URL / FORECAST_API_TOKEN).");
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(`${baseUrl.replace(/\/+$/, "")}/forecast`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ horizon: options.horizon, quantiles: [0.1, 0.5, 0.9], series: options.series }),
    signal: AbortSignal.timeout(options.timeoutMs ?? FORECAST_REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Forecast service answered ${response.status}.`);
  }

  const payload = (await response.json()) as {
    model?: unknown;
    forecasts?: Array<{ id?: unknown; quantiles?: Record<string, unknown> }>;
  };
  if (typeof payload.model !== "string" || !Array.isArray(payload.forecasts)) {
    throw new Error("Forecast service returned an unexpected payload.");
  }

  const forecasts = new Map<string, DailyQuantiles>();
  for (const item of payload.forecasts) {
    const p10 = item.quantiles?.["0.1"];
    const p50 = item.quantiles?.["0.5"];
    const p90 = item.quantiles?.["0.9"];
    if (typeof item.id !== "string" || !isNumberArray(p10, options.horizon) || !isNumberArray(p50, options.horizon) || !isNumberArray(p90, options.horizon)) {
      throw new Error("Forecast service returned a malformed series.");
    }
    forecasts.set(item.id, { p10, p50, p90 });
  }

  for (const series of options.series) {
    if (!forecasts.has(series.id)) {
      throw new Error(`Forecast service omitted series ${series.id}.`);
    }
  }

  return { model: payload.model, forecasts };
}
