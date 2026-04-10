import { NextResponse } from "next/server";

import { translateFinanceErrorMessage } from "@/features/finance/server/api-errors";
import { getRequestTranslator } from "@/i18n/translator";

export async function financeErrorResponse(
  request: Request,
  error: unknown,
  fallbackKey: string,
) {
  const t = (await getRequestTranslator(request)) as (key: string) => string;
  const unauthorized = error instanceof Error && error.message === "Unauthorized";
  const message =
    error instanceof Error
      ? translateFinanceErrorMessage(t, error.message)
      : t(fallbackKey);
  const status = unauthorized ? 401 : 400;

  return NextResponse.json({ error: message }, { status });
}

export async function financeSnapshotErrorResponse(request: Request, error: unknown) {
  const t = (await getRequestTranslator(request)) as (key: string) => string;
  const unauthorized = error instanceof Error && error.message === "Unauthorized";
  const message =
    error instanceof Error
      ? translateFinanceErrorMessage(t, error.message)
      : t("common.errors.finance.load");
  const status = unauthorized ? 401 : 500;

  return NextResponse.json({ error: message }, { status });
}

export async function bankingSnapshotErrorResponse(request: Request, error: unknown) {
  const t = (await getRequestTranslator(request)) as (key: string) => string;
  const unauthorized = error instanceof Error && error.message === "Unauthorized";
  const message =
    error instanceof Error
      ? translateFinanceErrorMessage(t, error.message)
      : t("common.errors.banking.load");
  const status = unauthorized ? 401 : 500;

  return NextResponse.json({ error: message }, { status });
}
