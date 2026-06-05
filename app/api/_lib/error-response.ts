import { NextResponse } from "next/server";

import { translateFinanceErrorMessage } from "@/features/finance/server/api-errors";
import { isBillingAccessError } from "@/lib/billing/access";
import { getRequestTranslator } from "@/i18n/translator";

type TranslationValues = Record<string, string | number | Date>;

export async function localizedErrorResponse(
  request: Request,
  key: string,
  status: number,
  values?: TranslationValues,
) {
  const t = (await getRequestTranslator(request)) as (key: string, values?: TranslationValues) => string;

  return NextResponse.json({ error: t(key, values) }, { status });
}

export async function localizedOAuthErrorResponse(
  request: Request,
  error: string,
  descriptionKey: string | null,
  status: number,
  init?: ResponseInit,
  values?: TranslationValues,
) {
  const t = (await getRequestTranslator(request)) as (key: string, values?: TranslationValues) => string;
  const body = descriptionKey
    ? { error, error_description: t(descriptionKey, values) }
    : { error };

  return NextResponse.json(body, { ...init, status });
}

export async function financeErrorResponse(
  request: Request,
  error: unknown,
  fallbackKey: string,
) {
  const t = (await getRequestTranslator(request)) as (key: string) => string;
  const unauthorized = error instanceof Error && error.message === "Unauthorized";
  const subscriptionRequired = isBillingAccessError(error);
  const message =
    error instanceof Error
      ? translateFinanceErrorMessage(t, error.message)
      : t(fallbackKey);
  const status = unauthorized ? 401 : subscriptionRequired ? 402 : 400;

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
      : t("common.errors.imports.load");
  const status = unauthorized ? 401 : 500;

  return NextResponse.json({ error: message }, { status });
}
