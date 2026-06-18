import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchFmpQuotes = vi.fn();
const fetchDeutscheBoerseQuotes = vi.fn();
const upsert = vi.fn();

vi.mock("server-only", () => ({}));

vi.mock("@/features/investments/server/fmp-provider", () => ({
  fetchFmpQuotes,
  searchFmpInstruments: vi.fn(),
}));

vi.mock("@/features/investments/server/deutsche-boerse-provider", () => ({
  fetchDeutscheBoerseQuotes,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: (table: string) => {
      if (table === "investment_positions") {
        return {
          select: () => ({
            eq: async () => ({
              data: [
                {
                  instrument_id: "instrument-vuaa",
                  investment_instruments: {
                    id: "instrument-vuaa",
                    provider: "fmp",
                    provider_symbol: "VUAA.DE",
                    quote_currency: "EUR",
                    isin: "IE00BFMXXD54",
                    exchange: "XETRA",
                  },
                },
                {
                  instrument_id: "instrument-spyl",
                  investment_instruments: {
                    id: "instrument-spyl",
                    provider: "fmp",
                    provider_symbol: "SPYL.DE",
                    quote_currency: "EUR",
                    isin: "IE000XZSV718",
                    exchange: "XETRA",
                  },
                },
              ],
              error: null,
            }),
          }),
        };
      }

      return {
        upsert: (rows: unknown[]) => {
          upsert(rows);
          return {
            select: async () => ({
              data: [
                {
                  instrument_id: "instrument-vuaa",
                  provider: "fmp",
                  market_date: "2026-06-18",
                  price: 107.32,
                  currency: "EUR",
                  fetched_at: "2026-06-18T12:00:00Z",
                },
              ],
              error: null,
            }),
          };
        },
      };
    },
  }),
}));

describe("investment quote repository", () => {
  beforeEach(() => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test";
    process.env.FMP_API_KEY = "test";
    fetchFmpQuotes.mockReset();
    fetchDeutscheBoerseQuotes.mockReset();
    upsert.mockClear();
  });

  it("saves available quotes and reports instruments that remain missing", async () => {
    fetchFmpQuotes.mockResolvedValue({
      requested_symbols: ["VUAA.DE", "SPYL.DE"],
      quotes: [
        {
          provider_symbol: "VUAA.DE",
          provider: "fmp",
          price: 107.32,
          market_date: "2026-06-18",
          currency: "EUR",
        },
      ],
      missing_symbols: ["SPYL.DE"],
    });
    fetchDeutscheBoerseQuotes.mockResolvedValue([]);

    const { refreshInvestmentQuotes } = await import("@/features/investments/server/repository");
    const result = await refreshInvestmentQuotes();

    expect(fetchFmpQuotes).toHaveBeenCalledWith([
      {
        provider_symbol: "VUAA.DE",
        quote_currency: "EUR",
        isin: "IE00BFMXXD54",
        exchange: "XETRA",
      },
      {
        provider_symbol: "SPYL.DE",
        quote_currency: "EUR",
        isin: "IE000XZSV718",
        exchange: "XETRA",
      },
    ]);
    expect(upsert).toHaveBeenCalledOnce();
    expect(result).toMatchObject({
      requested_symbols: ["VUAA.DE", "SPYL.DE"],
      saved_symbols: ["VUAA.DE"],
      missing_symbols: ["SPYL.DE"],
    });
  });

  it("uses Deutsche Börse when FMP is not configured", async () => {
    delete process.env.FMP_API_KEY;
    fetchDeutscheBoerseQuotes.mockResolvedValue([
      {
        provider_symbol: "VUAA.DE",
        provider: "deutsche-boerse",
        price: 125.81,
        market_date: "2026-06-18",
        currency: "EUR",
      },
    ]);

    const { refreshInvestmentQuotes } = await import("@/features/investments/server/repository");
    const result = await refreshInvestmentQuotes();

    expect(fetchFmpQuotes).not.toHaveBeenCalled();
    expect(fetchDeutscheBoerseQuotes).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      requested_symbols: ["VUAA.DE", "SPYL.DE"],
      saved_symbols: ["VUAA.DE"],
      missing_symbols: ["SPYL.DE"],
    });
  });
});
