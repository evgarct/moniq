import { describe, expect, it, vi } from "vitest";

import { requestForecast } from "@/lib/forecast/client";

const options = { baseUrl: "https://forecast.example/", token: "secret", horizon: 2, series: [{ id: "cafe", start: "2026-09-01", values: [1, 2, 3] }] };

function jsonResponse(body: unknown, status = 200) {
  return Promise.resolve(new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } }));
}

const good = {
  model: "amazon/chronos-bolt-small",
  forecasts: [{ id: "cafe", start: "2026-09-04", quantiles: { "0.1": [1, 1], "0.5": [2, 2], "0.9": [3, 3] } }],
};

describe("requestForecast", () => {
  it("posts the series with the bearer token and parses the quantile paths", async () => {
    const fetchImpl = vi.fn(() => jsonResponse(good));
    const result = await requestForecast({ ...options, fetchImpl: fetchImpl as unknown as typeof fetch });

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://forecast.example/forecast");
    expect((init.headers as Record<string, string>).authorization).toBe("Bearer secret");
    expect(JSON.parse(init.body as string)).toMatchObject({ horizon: 2, quantiles: [0.1, 0.5, 0.9] });
    expect(result.model).toBe("amazon/chronos-bolt-small");
    expect(result.forecasts.get("cafe")).toEqual({ p10: [1, 1], p50: [2, 2], p90: [3, 3] });
  });

  it("throws instead of inventing numbers when the service is down or unconfigured", async () => {
    await expect(requestForecast({ ...options, fetchImpl: (() => jsonResponse({}, 503)) as unknown as typeof fetch })).rejects.toThrow("503");
    await expect(requestForecast({ ...options, token: undefined, baseUrl: undefined })).rejects.toThrow("not configured");
  });

  it("rejects malformed or incomplete answers", async () => {
    const wrongLength = { ...good, forecasts: [{ id: "cafe", quantiles: { "0.1": [1], "0.5": [2, 2], "0.9": [3, 3] } }] };
    await expect(requestForecast({ ...options, fetchImpl: (() => jsonResponse(wrongLength)) as unknown as typeof fetch })).rejects.toThrow("malformed");

    const missingSeries = { ...good, forecasts: [] };
    await expect(requestForecast({ ...options, fetchImpl: (() => jsonResponse(missingSeries)) as unknown as typeof fetch })).rejects.toThrow("omitted");
  });
});
