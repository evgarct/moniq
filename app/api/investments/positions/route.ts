import { NextResponse } from "next/server";
import { z } from "zod";

import { financeErrorResponse } from "@/app/api/_lib/error-response";
import { getFinanceSnapshot, saveInvestmentPosition } from "@/features/finance/server/repository";
import { ensureInvestmentInstrument } from "@/features/investments/server/repository";
import { requireMutationEntitlementForRequest } from "@/lib/billing/server";
import { SUPPORTED_CURRENCY_CODES } from "@/lib/currencies";
import { investmentPositionInputSchema } from "@/types/finance-schemas";

const instrumentSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().min(1),
  type: z.enum(["stock", "etf"]),
  ticker: z.string().min(1),
  exchange: z.string().min(1),
  quote_currency: z.enum(SUPPORTED_CURRENCY_CODES),
  isin: z.string().nullable(),
  provider: z.literal("fmp"),
  provider_symbol: z.string().min(1),
});

const payloadSchema = z.object({
  instrument: instrumentSchema,
  opening_units: z.number().min(0),
});

export async function POST(request: Request) {
  try {
    await requireMutationEntitlementForRequest(request);
    const payload = payloadSchema.parse(await request.json());
    const instrument = payload.instrument.id
      ? payload.instrument
      : await ensureInvestmentInstrument(payload.instrument);
    await saveInvestmentPosition(investmentPositionInputSchema.parse({
      instrument_id: instrument.id,
      opening_units: payload.opening_units,
    }));
    return NextResponse.json(await getFinanceSnapshot());
  } catch (error) {
    return financeErrorResponse(request, error, "common.errors.investment.save");
  }
}
