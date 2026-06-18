import { afterEach, describe, expect, it, vi } from "vitest";

const refreshInvestmentQuotes = vi.fn();

vi.mock("@/features/investments/server/repository", () => ({
  refreshInvestmentQuotes,
}));

afterEach(() => {
  delete process.env.CRON_SECRET;
  refreshInvestmentQuotes.mockReset();
});

describe("GET /api/investments/quotes/refresh", () => {
  it("fails explicitly when the cron secret is not configured", async () => {
    const { GET } = await import("@/app/api/investments/quotes/refresh/route");
    const response = await GET(new Request("https://moniq.local/api/investments/quotes/refresh"));

    expect(response.status).toBe(500);
    expect(refreshInvestmentQuotes).not.toHaveBeenCalled();
  });

  it("returns a failing status when any active instrument remains without a quote", async () => {
    process.env.CRON_SECRET = "secret";
    refreshInvestmentQuotes.mockResolvedValue({
      requested_symbols: ["VUAA.DE", "SPYL.DE"],
      saved_symbols: ["VUAA.DE"],
      missing_symbols: ["SPYL.DE"],
      quotes: [],
    });
    const { GET } = await import("@/app/api/investments/quotes/refresh/route");
    const response = await GET(new Request("https://moniq.local/api/investments/quotes/refresh", {
      headers: { authorization: "Bearer secret" },
    }));

    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toMatchObject({
      status: "partial",
      missing_symbols: ["SPYL.DE"],
    });
  });

  it("returns success only when every requested quote was saved", async () => {
    process.env.CRON_SECRET = "secret";
    refreshInvestmentQuotes.mockResolvedValue({
      requested_symbols: ["VUAA.DE", "SPYL.DE"],
      saved_symbols: ["VUAA.DE", "SPYL.DE"],
      missing_symbols: [],
      quotes: [],
    });
    const { GET } = await import("@/app/api/investments/quotes/refresh/route");
    const response = await GET(new Request("https://moniq.local/api/investments/quotes/refresh", {
      headers: { authorization: "Bearer secret" },
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: "ok",
      saved_symbols: ["VUAA.DE", "SPYL.DE"],
    });
  });
});
